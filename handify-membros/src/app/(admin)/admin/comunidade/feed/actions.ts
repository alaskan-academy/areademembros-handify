"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { sendNewsPostEmailBatch } from "@/lib/email";
import { fetchAll } from "@/lib/supabase/fetch-all";

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autorizado");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Não autorizado");
  return { supabase, user };
}

export async function uploadCommunityImage(
  formData: FormData
): Promise<{ url?: string; error?: string }> {
  await assertAdmin();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Arquivo obrigatório" };
  if (file.size > 5_242_880) return { error: "Imagem muito grande (max 5MB)" };
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type))
    return { error: "Formato inválido. Use JPG, PNG, WebP ou GIF" };

  const service = createServiceClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `feed/${Date.now()}.${ext}`;
  const { error } = await service.storage.from("community").upload(path, file, { upsert: false });
  if (error) return { error: "Erro ao fazer upload da imagem" };

  const { data: urlData } = service.storage.from("community").getPublicUrl(path);
  return { url: urlData.publicUrl };
}

const postSchema = z.object({
  title: z.string().min(3, "Título muito curto").max(200, "Título muito longo"),
  body: z.string().max(10000, "Texto muito longo"),
  image_url: z.string().url("URL inválida").or(z.literal("")).optional(),
  published: z.boolean(),
  pinned: z.boolean(),
});

export async function createNewsPost(formData: FormData): Promise<{ error?: string }> {
  const { user } = await assertAdmin();

  const parsed = postSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body") ?? "",
    image_url: formData.get("image_url") ?? "",
    published: formData.get("published") === "true",
    pinned: formData.get("pinned") === "true",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: criado, error } = await supabase
    .from("news_posts")
    .insert({
      author_id: user.id,
      title: parsed.data.title,
      body: parsed.data.body,
      image_url: parsed.data.image_url || null,
      published: parsed.data.published,
      pinned: parsed.data.pinned,
    })
    .select("id")
    .single();

  if (error) return { error: "Erro ao criar post" };
  revalidatePath("/admin/comunidade/feed");
  revalidatePath("/comunidade/feed");

  // É AQUI que o e-mail de post novo sai, e é o ponto que faltava.
  //
  // Antes só `toggleNewsPublished` chamava o envio — mas o formulário cria o
  // post JÁ publicado, e o gatilho do banco carimba `notified_at` no próprio
  // insert. Resultado: o claim de `notified_at` daquela função nunca casava
  // para post criado pelo formulário, e o e-mail não saía para post novo
  // nenhum. O interruptor podia estar ligado que não mudava nada.
  //
  // `after()` porque o envio é um lote para milhares e não pode segurar a
  // resposta do formulário; a admin vê o post criado na hora. Quem impede
  // envio repetido é o claim de `emailed_at` dentro de `notifyNewsPost`, não
  // este caminho — então rechamar daqui é inofensivo.
  if (criado?.id && parsed.data.published) {
    const id = criado.id;
    after(async () => {
      try {
        const r = await notifyNewsPost(id);
        if (r.error) console.error(`[feed] e-mail do post ${id}:`, r.error);
      } catch (e) {
        console.error(`[feed] e-mail do post ${id}:`, e);
      }
    });
  }

  return {};
}

export async function updateNewsPost(id: string, formData: FormData): Promise<{ error?: string }> {
  await assertAdmin();

  const parsed = postSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body") ?? "",
    image_url: formData.get("image_url") ?? "",
    published: formData.get("published") === "true",
    pinned: formData.get("pinned") === "true",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("news_posts").update({
    title: parsed.data.title,
    body: parsed.data.body,
    image_url: parsed.data.image_url || null,
    published: parsed.data.published,
    pinned: parsed.data.pinned,
  }).eq("id", id);

  if (error) return { error: "Erro ao atualizar post" };
  revalidatePath("/admin/comunidade/feed");
  revalidatePath("/comunidade/feed");
  return {};
}

export async function deleteNewsPost(id: string): Promise<{ error?: string }> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("news_posts").delete().eq("id", id);
  if (error) return { error: "Erro ao deletar post" };
  revalidatePath("/admin/comunidade/feed");
  revalidatePath("/comunidade/feed");
  return {};
}

/**
 * Interruptor do e-mail de "post novo no feed". LIGADO desde 24/09/2026, a
 * pedido da Jessica: "ligue mas não dispare, dispare apenas para os novos posts
 * que vierem".
 *
 * O "não dispare" não mora aqui — mora em `news_posts.emailed_at`, que a
 * migration 20260924_email_de_post_novo_ligado.sql carimbou em TODOS os posts
 * que existiam naquele momento. Nenhum deles consegue mandar e-mail, nem
 * publicado agora, nem republicado daqui a seis meses. Só post criado a partir
 * dali nasce com `emailed_at` nulo.
 *
 * Desligar de novo é trocar para `false` — e aí o caminho inteiro para na
 * primeira linha de `notifyNewsPost`, sem carimbar nada.
 *
 * O sino não depende disto: quem toca o sino é o gatilho
 * `on_news_post_published` no banco, por `notified_at`. São duas perguntas
 * diferentes e dois carimbos diferentes.
 */
const ENVIAR_EMAIL_DE_POST_NOVO = true;

export async function toggleNewsPublished(
  id: string,
  published: boolean
): Promise<{ error?: string }> {
  await assertAdmin();
  const supabase = await createClient();

  if (!published) {
    const { error } = await supabase.from("news_posts").update({ published: false }).eq("id", id);
    if (error) return { error: "Erro ao atualizar status" };
    revalidatePath("/admin/comunidade/feed");
    revalidatePath("/comunidade/feed");
    return {};
  }

  // Claim atômico. O WHERE é avaliado na linha ANTIGA, então só a primeira
  // publicação casa com `notified_at is null`. Um segundo clique — ou um
  // republish meses depois — re-avalia contra a linha já carimbada e volta 0
  // linhas, então não anuncia de novo. Quem carimba `notified_at` é o gatilho
  // BEFORE do banco (20260922_feed_nao_renotifica.sql), não este update.
  //
  // Antes disto, despublicar e republicar renotificava as 4.5 mil alunas de
  // novo, quantas vezes a admin clicasse: a única guarda era a transição
  // false->true, que se repete a cada republish.
  const { data: primeiraVez, error } = await supabase
    .from("news_posts")
    .update({ published: true })
    .eq("id", id)
    .is("notified_at", null)
    .select("id");

  if (error) return { error: "Erro ao atualizar status" };

  if (!primeiraVez?.length) {
    // Republish de post já anunciado: volta ao ar, sem sino e sem e-mail.
    const { error: e2 } = await supabase.from("news_posts").update({ published: true }).eq("id", id);
    if (e2) return { error: "Erro ao atualizar status" };
  }

  revalidatePath("/admin/comunidade/feed");
  revalidatePath("/comunidade/feed");

  if (primeiraVez?.length) {
    // Publicar já funcionou. Se o e-mail falhar, isso não pode desfazer nem
    // mascarar a publicação — vai para o log com o id do post, e `notifyNewsPost`
    // é idempotente por aluna, então dá para rechamar sem remandar para ninguém.
    try {
      const r = await notifyNewsPost(id);
      if (r.error) console.error(`[feed] e-mail do post ${id}:`, r.error);
    } catch (e) {
      console.error(`[feed] e-mail do post ${id}:`, e);
    }
  }
  return {};
}

type PerfilDoFeed = {
  id: string;
  full_name: string | null;
  email: string | null;
  email_prefs: Record<string, boolean> | null;
};

/**
 * Manda o aviso de post novo por e-mail. Não toca no sino: o sino é
 * exclusividade do gatilho do banco. Manter os dois inserindo em
 * `notifications` entregava 2 sinos por aluna já na primeira publicação.
 *
 * Três coisas que o caminho antigo errava e que aqui estão fechadas:
 *  - o público vinha de um `select` solto, e o PostgREST corta em 1.000 sem
 *    avisar: 3.5 mil das 4.5 mil alunas ficavam de fora em silêncio;
 *  - o envio era um `await` por aluna em série, disparado com `void` de dentro
 *    de uma Server Action — não cabia no tempo da função e nunca terminava;
 *  - não havia registro de quem recebeu, então uma queda no meio do lote
 *    obrigava a remandar para todo mundo.
 */
async function notifyNewsPost(postId: string): Promise<{ enviados: number; error?: string }> {
  if (!ENVIAR_EMAIL_DE_POST_NOVO) {
    console.info(`[feed] post ${postId} publicado; e-mail desligado (ENVIAR_EMAIL_DE_POST_NOVO)`);
    return { enviados: 0 };
  }

  const service = createServiceClient();

  // Reivindicação atômica, no mesmo padrão do anúncio de curso: o WHERE é
  // avaliado na linha ANTIGA, então só a primeira chamada casa com
  // `emailed_at is null`. Segundo clique, republish meses depois, ou dois
  // caminhos chamando ao mesmo tempo voltam 0 linhas e saem sem mandar nada.
  //
  // É esta linha que garante o "dispare apenas para os novos posts": todos os
  // posts anteriores a 24/09/2026 foram carimbados na migration, então nenhum
  // deles passa daqui.
  //
  // Carimbar ANTES de enviar é de propósito. O contrário — enviar e depois
  // carimbar — deixa a janela em que uma segunda chamada manda tudo de novo
  // para as 4.550 alunas enquanto a primeira ainda está no meio do lote.
  const { data: reivindicado, error: erroClaim } = await service
    .from("news_posts")
    .update({ emailed_at: new Date().toISOString() })
    .eq("id", postId)
    .is("emailed_at", null)
    .select("id, title, body, published");

  if (erroClaim) return { enviados: 0, error: `claim de emailed_at: ${erroClaim.message}` };

  const post = reivindicado?.[0];
  if (!post) {
    console.info(`[feed] post ${postId}: e-mail já enviado antes, nada a fazer`);
    return { enviados: 0 };
  }

  /** Devolve o post para "não enviado" quando nada saiu — senão ele fica marcado sem ter ido. */
  const soltarClaim = async () => {
    await service.from("news_posts").update({ emailed_at: null }).eq("id", postId);
  };

  if (!post.published) {
    await soltarClaim();
    return { enviados: 0, error: "Publique o post antes de enviar o e-mail" };
  }

  // Idempotência por aluna, na tabela que já existe (20260904_email_campaign_sends).
  // É o que permite retomar um lote interrompido sem repetir para quem já recebeu.
  const campanha = `feed-post-${postId}`;
  const jaForam = await fetchAll<{ user_id: string }>((de, ate) =>
    service.from("email_campaign_sends").select("user_id").eq("campaign", campanha).range(de, ate)
  );
  const enviadas = new Set(jaForam.map((r) => r.user_id));

  const perfis = await fetchAll<PerfilDoFeed>((de, ate) =>
    service
      .from("profiles")
      .select("id, full_name, email, email_prefs")
      .eq("role", "student")
      .eq("banned", false)
      .not("email", "is", null)
      .range(de, ate)
  );

  // Opt-OUT, igual a src/lib/campanhas/completo.ts: chave ausente conta como sim.
  const fila = perfis.filter(
    (p) => !!p.email && p.email_prefs?.news_post !== false && !enviadas.has(p.id)
  );
  if (!fila.length) return { enviados: 0 };

  const { enviados, erro } = await sendNewsPostEmailBatch(
    fila.map((p) => ({
      to: p.email!,
      studentName: p.full_name || "Aluna",
      postTitle: post.title,
      postBody: post.body ?? undefined,
    }))
  );

  // Registra só quem a Resend aceitou — registrar a fila inteira faria uma
  // falha no meio do lote virar "já mandei" para quem nunca recebeu.
  const ok = new Set(enviados.map((e) => e.toLowerCase()));
  const linhas = fila
    .filter((p) => ok.has(p.email!.toLowerCase()))
    .map((p) => ({ campaign: campanha, user_id: p.id, email: p.email! }));
  for (let i = 0; i < linhas.length; i += 500) {
    await service
      .from("email_campaign_sends")
      .upsert(linhas.slice(i, i + 500), { onConflict: "campaign,user_id" });
  }

  // Nada saiu: solta a reivindicação. Um post marcado como enviado que nunca
  // foi enviado é pior do que o defeito original — a admin publica, ninguém
  // recebe, e não há caminho de volta porque a trava já está fechada.
  //
  // Envio PARCIAL mantém a marca de propósito: `email_campaign_sends` já guarda
  // quem recebeu, então rechamar continua de onde parou sem remandar para
  // ninguém. Soltar aqui é só para o caso em que nem um e-mail saiu.
  if (enviados.length === 0) {
    await soltarClaim();
    console.error(
      `[feed] post ${postId}: nenhum e-mail saiu (${erro ?? "sem erro relatado"}); marca desfeita para poder tentar de novo`
    );
  }

  return { enviados: enviados.length, ...(erro ? { error: erro } : {}) };
}

export type AdminFeedComment = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  profiles: { full_name: string; avatar_url: string | null } | null;
};

export async function getNewsCommentsAdmin(postId: string): Promise<AdminFeedComment[]> {
  await assertAdmin();
  const service = createServiceClient();
  const { data } = await service
    .from("news_comments")
    .select("id, body, created_at, user_id, profiles!user_id(full_name, avatar_url)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  return (data as unknown as AdminFeedComment[]) ?? [];
}

export async function deleteNewsCommentAdmin(commentId: string): Promise<{ error?: string }> {
  await assertAdmin();
  const service = createServiceClient();
  const { error } = await service.from("news_comments").delete().eq("id", commentId);
  if (error) return { error: "Erro ao deletar comentário" };
  return {};
}

export async function toggleNewsPinned(
  id: string,
  pinned: boolean
): Promise<{ error?: string }> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("news_posts").update({ pinned }).eq("id", id);
  if (error) return { error: "Erro ao fixar/desfixar post" };
  revalidatePath("/admin/comunidade/feed");
  revalidatePath("/comunidade/feed");
  return {};
}
