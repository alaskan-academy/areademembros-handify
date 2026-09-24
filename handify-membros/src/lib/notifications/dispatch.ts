import "server-only";

// Disparo de campanha: notificação in-app para cada aluna alvo + Web Push.
//
// Mora fora de `actions.ts` de propósito. Lá o arquivo inteiro é "use server",
// e toda função exportada de um arquivo desses é endpoint público — o disparo
// ficou sem `requireAdmin()` porque a guarda óbvia quebraria o cron, que chama
// o mesmo código sem sessão e seria jogado no `redirect("/login")`. A guarda
// ficou no invólucro exportado de actions.ts; o trabalho ficou aqui, onde o
// cron pode chamar direto.

import { createServiceClient } from "@/lib/supabase/service";
import { broadcastPush } from "@/lib/push";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { revalidatePath } from "next/cache";

/**
 * `broadcastPush` monta `.in("user_id", userIds)`, que o supabase-js manda na
 * query string de um GET (src/lib/push/index.ts:72). Desde que o público passou
 * a ser paginado até o fim, essa lista tem a base inteira: 4.557 UUIDs viram
 * ~170 KB de URL, muito acima do que qualquer gateway aceita. O `.catch` engolia
 * o erro e o push sumia sem aparecer em lugar nenhum.
 */
const PUSH_BATCH = 500;

/**
 * Status a partir dos quais uma campanha pode ser reivindicada para disparo.
 *
 * 'sending' NÃO entra, de propósito. Havia aqui uma janela de retomada de 15
 * minutos (`RETOMADA_MS`) com dois ramos `sending` no `.or(...)` — e nenhum dos
 * dois rodava nunca: o cron procura só status='scheduled'
 * (src/app/api/notifications/dispatch/route.ts) e o painel não oferece "Enviar
 * agora" para 'sending'. Guarda sem chamador, o padrão que já custou dez dias
 * neste projeto.
 *
 * Só que essa guarda não era inofensiva: se algum dia alguém a acionasse, ela
 * reinseriria a notificação e o push para TODAS as alunas do público, incluindo
 * as que já tinham recebido antes da queda — `notifications` não tem dedupe.
 * Retomar disparo pela metade é impossível sem saber onde ele parou.
 *
 * A saída de 'sending' agora é o botão "Destravar" do painel
 * (`destravarCampanha` em ./actions), que conta o que já saiu e fecha a
 * campanha sem mandar nada de novo.
 */
const STATUS_REIVINDICAVEIS = ["draft", "scheduled", "parcial"] as const;

export async function dispararCampanha(campaignId: string) {
  const service = createServiceClient();

  // Status de antes da reivindicação, guardado só para o catch mais abaixo:
  // depois do UPDATE o valor antigo não existe em lugar nenhum, e devolver a
  // campanha para "sending" a deixaria fora do alcance do cron.
  const { data: antes } = await service
    .from("notification_campaigns")
    .select("status")
    .eq("id", campaignId)
    .maybeSingle();
  const statusAnterior = antes?.status ?? "draft";

  const agora = new Date().toISOString();

  // Reivindicação atômica da campanha. Antes eram três passos — ler, conferir o
  // status, gravar "sending" — e "sending" não estava entre os status recusados:
  // dois cliques em "Enviar agora" (duas abas, duas admins) ou o cron passando
  // por cima de um envio manual atravessavam o if os dois, e cada aluna recebia
  // a mesma notificação e o mesmo push em duplicata. UPDATE ... WHERE é uma
  // instrução só no Postgres: só uma chamada leva a linha.
  const { data: campaign } = await service
    .from("notification_campaigns")
    .update({ status: "sending", sending_since: agora })
    .eq("id", campaignId)
    .in("status", STATUS_REIVINDICAVEIS as unknown as string[])
    .select("id, title, body, link, target")
    .maybeSingle();

  // Não ganhou a linha: ou a campanha não existe, ou já foi enviada/cancelada,
  // ou está em 'sending' — disparo em andamento, ou um que morreu e espera o
  // "Destravar" do painel. Sair calado é o certo.
  if (!campaign) return;

  // Busca usuárias alvo
  let userIds: string[] = [];

  try {
    // Paginado: o Supabase corta em 1.000 linhas sem avisar. A campanha
    // "Ferramentas novas na Handify" de 05/09/2026 foi para 1.000 alunas de 3.474
    // e ficou gravada como "enviada" — 2.474 nunca souberam do aviso, e o painel
    // mostrava o 1.000 redondo como se fosse a base inteira.
    if (campaign.target === "all") {
      const profiles = await fetchAll<{ id: string }>((de, ate) =>
        service
          .from("profiles")
          .select("id")
          .eq("role", "student")
          .eq("banned", false)
          .range(de, ate)
      );
      userIds = profiles.map((p) => p.id);
    } else if (campaign.target.startsWith("course:")) {
      const courseId = campaign.target.replace("course:", "");
      const now = new Date().toISOString();
      const enrollments = await fetchAll<{ user_id: string }>((de, ate) =>
        service
          .from("enrollments")
          .select("user_id")
          .eq("course_id", courseId)
          .or(`expires_at.is.null,expires_at.gte.${now}`)
          .range(de, ate)
      );
      userIds = enrollments.map((e) => e.user_id);
    }
  } catch (e) {
    // `fetchAll` lança quando uma página falha ou quando bate no teto de linhas.
    // Sem este catch a campanha ficava em "sending" para sempre: o cron só
    // procura status='scheduled' e o painel não oferecia botão nenhum para
    // "enviando". Nenhuma notificação foi inserida até aqui, então voltar ao
    // status anterior não duplica envio — 'scheduled' faz o cron tentar de novo
    // na próxima hora, 'draft' devolve o controle à admin. (Se mesmo assim a
    // linha ficar presa, o botão "Destravar" do painel resolve sem reenviar.)
    await service
      .from("notification_campaigns")
      .update({ status: statusAnterior, sending_since: null })
      .eq("id", campaignId);
    console.error("[dispatch] publico nao pode ser montado:", e);
    throw e;
  }

  if (userIds.length === 0) {
    await service
      .from("notification_campaigns")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        sent_count: 0,
        target_count: 0,
        // Limpar aqui e no UPDATE final: sending_since que fica sujo vira a
        // janela de contagem de um "Destravar" futuro — e contar a partir de um
        // instante errado devolve um sent_count errado.
        sending_since: null,
      })
      .eq("id", campaignId);
    return;
  }

  // Insere notificações in-app em batch (máx 500 por vez)
  const BATCH = 500;
  let totalSent = 0;
  let houveFalha = false;
  for (let i = 0; i < userIds.length; i += BATCH) {
    const batch = userIds.slice(i, i + BATCH).map((userId) => ({
      user_id: userId,
      type: "admin_broadcast",
      title: campaign.title,
      body: campaign.body,
      link: campaign.link ?? null,
      read: false,
      // Sem esta coluna não existia nenhum vínculo entre a notificação e a
      // campanha, e `sent_count` só é gravado no UPDATE final lá embaixo. Numa
      // queda no meio do disparo não havia como saber quantas alunas já tinham
      // recebido — nem para a admin, nem para o "Destravar". Gravar aqui, lote
      // a lote, é o que torna a contagem possível mesmo quando o final não roda.
      campaign_id: campaignId,
    }));
    const { error: erroLote } = await service.from("notifications").insert(batch);
    if (erroLote) {
      // Somar o tamanho do lote sem olhar o retorno era contar o que a gente
      // tentou, não o que entrou. Campanha com falha parcial agora fica
      // marcada como tal, em vez de virar um "enviada" que ninguém confere.
      console.error("[dispatch] lote falhou:", erroLote.message);
      houveFalha = true;
      continue;
    }
    totalSent += batch.length;
  }

  // Dispara push para usuárias com subscription ativa (fire-and-forget), em
  // fatias — ver PUSH_BATCH.
  for (let i = 0; i < userIds.length; i += PUSH_BATCH) {
    broadcastPush(
      { title: campaign.title, body: campaign.body, link: campaign.link ?? undefined },
      userIds.slice(i, i + PUSH_BATCH)
    ).catch((e) => console.error("[dispatch] push error:", e));
  }

  const { error: erroStatus } = await service
    .from("notification_campaigns")
    .update({
      // "parcial" quando faltou gente: o número no painel precisa dizer a
      // verdade, senão a admin acha que falou com a base inteira.
      status: houveFalha || totalSent < userIds.length ? "parcial" : "sent",
      sent_at: new Date().toISOString(),
      sent_count: totalSent,
      // Sem o alvo, "1.000 enviadas" não diz se foi tudo ou um quinto.
      target_count: userIds.length,
      sending_since: null,
    })
    .eq("id", campaignId);

  if (erroStatus) {
    // Era o único UPDATE da função cujo erro caía no chão — e é justamente o
    // que grava o sent_count. Num banco sem a migration de 'parcial' ele é
    // recusado pelo CHECK, e a campanha que entregou tudo fica registrada como
    // "sending" com sent_count 0, para sempre.
    console.error("[dispatch] status nao gravado:", erroStatus.message);
  }

  revalidatePath("/admin/notificacoes");
}

/** Campanha travada, com o que a contagem precisa saber sobre ela. */
export type CampanhaParaContar = {
  id: string;
  title: string;
  sending_since: string | null;
  created_at: string;
};

/**
 * Quantas notificações esta campanha já inseriu — a pergunta que não tinha
 * resposta quando um disparo morria no meio.
 *
 * `sent_count` só é gravado no UPDATE final do disparo. Se a função da Vercel
 * cai no timeout no meio do laço de lotes, esse UPDATE nunca roda: a campanha
 * fica em 'sending' com sent_count 0, mesmo tendo alcançado milhares de alunas.
 * Contar aqui, direto em `notifications`, é a única forma de dizer a verdade.
 *
 * Duas contagens, nesta ordem:
 *
 *  1. por `campaign_id` — exata, é o caminho normal desde 24/09/2026;
 *  2. por título + tipo + janela de tempo — aproximada, só para campanha cujas
 *     notificações são anteriores à coluna `campaign_id`. A janela começa em
 *     `sending_since` (o instante em que o disparo reivindicou a linha), então
 *     campanha antiga de mesmo título não entra na conta.
 *
 * As duas usam `count: "exact", head: true`: uma consulta só, nenhuma linha
 * trafegada, e sobretudo nenhum teto de 1.000 — somar linhas recebidas foi
 * exatamente o que fez a campanha de 05/09/2026 registrar 1.000 de 3.474.
 */
export async function contarNotificacoesDaCampanha(
  campanha: CampanhaParaContar
): Promise<{ total: number; aproximado: boolean }> {
  const service = createServiceClient();

  const { count: porCampanha, error: erroPorCampanha } = await service
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campanha.id);

  // Deixar estourar é de propósito: se a coluna não existe (migration não
  // aplicada) ou a consulta falha, quem chama precisa recusar o destravamento
  // em vez de gravar um sent_count inventado.
  if (erroPorCampanha) {
    throw new Error(`[dispatch] contagem por campaign_id falhou: ${erroPorCampanha.message}`);
  }

  if ((porCampanha ?? 0) > 0) {
    return { total: porCampanha ?? 0, aproximado: false };
  }

  // Campanha antiga: nada foi gravado com campaign_id. Cai no título, dentro da
  // janela deste disparo. `sending_since` pode ser nulo em linha anterior a
  // 22/09/2026 — aí o começo da campanha é o melhor limite que existe.
  const inicioDaJanela = campanha.sending_since ?? campanha.created_at;

  const { count: porTitulo, error: erroPorTitulo } = await service
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("type", "admin_broadcast")
    .eq("title", campanha.title)
    .gte("created_at", inicioDaJanela);

  if (erroPorTitulo) {
    throw new Error(`[dispatch] contagem por título falhou: ${erroPorTitulo.message}`);
  }

  const total = porTitulo ?? 0;

  // Zero pelos dois caminhos é zero de verdade: o disparo caiu antes do primeiro
  // lote. Não vale marcar como aproximado — seria duvidar de um número certo.
  return { total, aproximado: total > 0 };
}
