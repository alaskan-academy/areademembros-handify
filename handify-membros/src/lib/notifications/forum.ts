import "server-only";

// Avisos do fórum e a árvore de comentários.
//
// Mora fora de `forum/actions.ts` por dois motivos. O primeiro é o de sempre:
// aquele arquivo é "use server" inteiro, e toda função exportada de lá vira
// endpoint público — regra pura como `montarArvoreDeComentarios` não tem por
// que ficar exposta, e nem dá para importar num teste (o import puxa
// next/headers junto). O segundo é que a regra de QUEM recebe aviso precisa
// ser escrita uma vez só: o banco põe o sino (gatilho
// `notify_on_comment_reply`) e este arquivo entrega o Web Push para a MESMA
// pessoa. Se as duas listas divergirem, alguém recebe push de um aviso que não
// existe no sino — ou o contrário.
//
// O que estava quebrado antes disto: nada avisava a equipe quando uma aluna
// postava ou respondia no fórum. Em setembro/2026 eram 18 comentários de aluna
// sem nenhuma resposta depois — ninguém tinha como saber que existiam.

import { createServiceClient } from "@/lib/supabase/service";
import { sendPushToUser } from "@/lib/push";

/** Caminho do post dentro do fórum, com o comentário quando houver. */
export function linkDoPostNoForum(
  forumSlug: string,
  postId: string,
  comentarioId?: string | null
): string {
  const base = `/comunidade/forum/${forumSlug}?post=${postId}`;
  return comentarioId ? `${base}&comentario=${comentarioId}` : base;
}

/** Corta o texto para caber no sino sem cortar no meio de uma palavra. */
export function resumir(texto: string, limite = 140): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  if (limpo.length <= limite) return limpo;
  const corte = limpo.slice(0, limite);
  const ultimoEspaco = corte.lastIndexOf(" ");
  return (ultimoEspaco > limite * 0.6 ? corte.slice(0, ultimoEspaco) : corte) + "…";
}

// ── Quem recebe aviso de um comentário ───────────────────────────────

/**
 * As pessoas avisadas por um comentário novo, sem repetir ninguém e sem
 * incluir quem escreveu.
 *
 * A mesma regra está escrita em SQL dentro de `notify_on_comment_reply()`
 * (supabase/migrations/20260923_forum_avisa_admin.sql). Mudou aqui, muda lá:
 * o SQL põe o sino, esta função decide para quem sai o push.
 *
 * - resposta a comentário → a dona do comentário respondido;
 * - a dona do post também, porque é a thread dela (a menos que já esteja na
 *   lista, ou que seja ela mesma respondendo).
 */
export function quemRecebeAvisoDeComentario(p: {
  autorDoComentario: string;
  autorDoPost?: string | null;
  autorDoComentarioPai?: string | null;
}): string[] {
  const alvos: string[] = [];
  for (const candidato of [p.autorDoComentarioPai, p.autorDoPost]) {
    if (!candidato) continue;
    if (candidato === p.autorDoComentario) continue;
    if (alvos.includes(candidato)) continue;
    alvos.push(candidato);
  }
  return alvos;
}

// ── Árvore de comentários ────────────────────────────────────────────

export type ComentarioComPai = { id: string; parent_id: string | null };
export type Ramo<T> = T & { respostas: T[] };

/**
 * Transforma a lista plana de comentários em raízes + respostas, com UM nível
 * de profundidade (resposta de resposta sobe para a mesma altura, como o PRD
 * define).
 *
 * A regra que não pode quebrar: comentário nenhum some. O `parent_id` tem
 * `on delete set null`, então quando a dona apaga o comentário pai as respostas
 * dela continuam na tabela — e antes desta função elas apareciam soltas, porque
 * a tela mostrava a lista plana. Aqui um comentário cujo pai não está na lista
 * (apagado, ou de outro post) vira raiz em vez de desaparecer da tela.
 */
export function montarArvoreDeComentarios<T extends ComentarioComPai>(
  planos: T[]
): Ramo<T>[] {
  const porId = new Map<string, T>(planos.map((c) => [c.id, c]));

  /** Sobe até o comentário mais alto do fio. Pai ausente ou ciclo param a subida. */
  function idDaRaiz(c: T): string {
    let atual = c;
    const vistos = new Set<string>([c.id]);
    while (atual.parent_id) {
      const pai = porId.get(atual.parent_id);
      if (!pai || vistos.has(pai.id)) break;
      atual = pai;
      vistos.add(pai.id);
    }
    return atual.id;
  }

  const raizDe = new Map<string, string>();
  for (const c of planos) raizDe.set(c.id, idDaRaiz(c));

  const raizes: Ramo<T>[] = [];
  const porRaiz = new Map<string, Ramo<T>>();
  for (const c of planos) {
    if (raizDe.get(c.id) !== c.id) continue;
    const ramo = { ...c, respostas: [] as T[] };
    raizes.push(ramo);
    porRaiz.set(c.id, ramo);
  }

  for (const c of planos) {
    const idRaiz = raizDe.get(c.id)!;
    if (idRaiz === c.id) continue;
    const ramo = porRaiz.get(idRaiz);
    if (ramo) {
      ramo.respostas.push(c);
      continue;
    }
    // Rede de segurança para dados em ciclo (a→b→a): nenhum dos dois seria
    // raiz e os dois sumiriam da tela. Aparecer solto é melhor que sumir.
    const solto = { ...c, respostas: [] as T[] };
    raizes.push(solto);
    porRaiz.set(c.id, solto);
  }

  return raizes;
}

// ── Aviso para a equipe ──────────────────────────────────────────────

export type AtividadeDeForum = {
  /** Quem escreveu. Nunca recebe aviso de si mesma. */
  autorId: string;
  autorNome: string;
  tipo: "post" | "comentario";
  /** Título do post — é o que a equipe lê no sino. */
  tituloDoPost: string;
  /** O que foi escrito, já sem anexo nem formatação. */
  trecho: string;
  /** Caminho do post exato. Lista de fóruns não serve: ninguém acha o post. */
  link: string;
  /**
   * Quem o gatilho do banco já avisa por este mesmo comentário. Entra aqui para
   * ninguém receber dois sinos do mesmo evento — acontece quando a admin é a
   * dona do post e uma aluna responde.
   */
  jaAvisados?: (string | null | undefined)[];
};

/**
 * Põe o sino e manda o push para toda a equipe (`profiles.role = 'admin'`).
 *
 * Volume medido em set/2026: 5,3 comentários e 2,3 posts por dia. Aviso por
 * evento cabe sem incomodar; resumo diário seria complexidade sem motivo.
 *
 * Nunca lança. Este aviso roda DEPOIS do insert do post/comentário da aluna:
 * se o sino falhar, o que ela escreveu já está salvo e não pode ser desfeito
 * por causa disso.
 */
export async function avisarAdminsDoForum(a: AtividadeDeForum): Promise<number> {
  try {
    const service = createServiceClient();

    // Service client obrigatório: as policies de `profiles` só deixam a aluna
    // ler o próprio perfil, então com o cliente normal esta lista volta vazia e
    // o aviso não sai para ninguém.
    const { data: admins, error } = await service
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .eq("banned", false);

    if (error) {
      console.error("[forum] não deu para listar a equipe:", error.message);
      return 0;
    }

    const excluir = new Set<string>([a.autorId]);
    for (const id of a.jaAvisados ?? []) if (id) excluir.add(id);

    const alvos = (admins ?? [])
      .map((p) => p.id as string)
      .filter((id) => !excluir.has(id));

    if (alvos.length === 0) return 0;

    const titulo =
      a.tipo === "post"
        ? `Post novo no fórum: ${resumir(a.tituloDoPost, 60)}`
        : `Resposta nova em: ${resumir(a.tituloDoPost, 60)}`;
    const corpo = `${a.autorNome}: ${resumir(a.trecho)}`;

    // `notifications` não tem policy de INSERT — só o service role escreve lá.
    const { error: erroSino } = await service.from("notifications").insert(
      alvos.map((userId) => ({
        user_id: userId,
        type: "forum_activity",
        title: titulo,
        body: corpo,
        link: a.link,
        read: false,
      }))
    );
    if (erroSino) console.error("[forum] sino da equipe falhou:", erroSino.message);

    // O push é o que chega no celular — a equipe tem 3 aparelhos registrados.
    // allSettled: aparelho com inscrição vencida não pode derrubar os outros.
    await Promise.allSettled(
      alvos.map((userId) =>
        sendPushToUser(userId, { title: titulo, body: corpo, link: a.link })
      )
    );

    return alvos.length;
  } catch (e) {
    console.error("[forum] aviso para a equipe falhou:", e);
    return 0;
  }
}

/**
 * Push para quem o gatilho do banco acabou de avisar no sino.
 *
 * Só push: o insert em `notifications` é do gatilho, e duplicar aqui daria dois
 * sinos por comentário — foi exatamente o defeito do feed em set/2026.
 */
export async function pushDeRespostaNoForum(
  userIds: string[],
  dados: { tituloDoPost: string; autorNome: string; trecho: string; link: string }
): Promise<void> {
  if (userIds.length === 0) return;
  try {
    const titulo = `Nova resposta em: ${resumir(dados.tituloDoPost, 60)}`;
    const corpo = `${dados.autorNome}: ${resumir(dados.trecho)}`;
    await Promise.allSettled(
      userIds.map((id) =>
        sendPushToUser(id, { title: titulo, body: corpo, link: dados.link })
      )
    );
  } catch (e) {
    console.error("[forum] push de resposta falhou:", e);
  }
}
