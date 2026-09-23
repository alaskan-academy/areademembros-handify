"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchAll } from "@/lib/supabase/fetch-all";
import {
  avisarAdminsDoForum,
  linkDoPostNoForum,
  montarArvoreDeComentarios,
  pushDeRespostaNoForum,
  quemRecebeAvisoDeComentario,
} from "@/lib/notifications/forum";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";

export type ForumCommentRow = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  parent_id: string | null;
  image_url: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  profiles: { full_name: string; avatar_url: string | null; role: string } | null;
  /** Curtidas do comentário — `post_likes` com target_type 'forum_comment'. */
  like_count: number;
  /** Se quem está lendo já curtiu este comentário. */
  liked: boolean;
};

/** Comentário de raiz com as respostas penduradas (um nível só). */
export type ForumCommentNode = ForumCommentRow & { respostas: ForumCommentRow[] };

/** Anexos opcionais de uma resposta. Sobem por uploadForumFile antes do envio. */
export type ForumCommentAnexos = {
  imageUrl?: string | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
};

// post_likes é polimórfica e target_type é texto livre no banco — sem esta
// lista, uma Server Action pública aceitaria qualquer rótulo vindo do
// navegador e a tabela viraria depósito de lixo que ninguém consegue contar.
const alvoDeCurtidaSchema = z.enum(["forum_post", "forum_comment"]);
type AlvoDeCurtida = z.infer<typeof alvoDeCurtidaSchema>;

const CAMPOS_DO_COMENTARIO =
  "id, body, created_at, user_id, parent_id, image_url, attachment_url, attachment_name, profiles!user_id(full_name, avatar_url, role)";

type ComentarioCru = Omit<ForumCommentRow, "like_count" | "liked">;

export async function getForumComments(postId: string): Promise<ForumCommentNode[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const service = createServiceClient();
  const { data } = await service
    .from("forum_comments")
    .select(CAMPOS_DO_COMENTARIO)
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  const planos = (data as unknown as ComentarioCru[]) ?? [];
  if (planos.length === 0) return [];

  // Curtidas de comentário, todas de uma vez. Paginado: o PostgREST corta em
  // 1.000 linhas sem avisar, e contagem cortada aparece como número menor na
  // tela — ninguém desconfiaria.
  const ids = planos.map((c) => c.id);
  const curtidas = await fetchAll<{ target_id: string; user_id: string }>((de, ate) =>
    service
      .from("post_likes")
      .select("target_id, user_id")
      .eq("target_type", "forum_comment")
      .in("target_id", ids)
      .range(de, ate)
  ).catch((e) => {
    // Curtida é enfeite: se a contagem não vier, os comentários ainda têm que
    // aparecer. Mas o erro vai para o log — contagem zerada em silêncio já nos
    // custou caro em outros lugares.
    console.error("[forum] contagem de curtidas de comentário falhou:", e);
    return [] as { target_id: string; user_id: string }[];
  });

  const contagem = new Map<string, number>();
  const minhas = new Set<string>();
  for (const c of curtidas) {
    contagem.set(c.target_id, (contagem.get(c.target_id) ?? 0) + 1);
    if (c.user_id === user.id) minhas.add(c.target_id);
  }

  return montarArvoreDeComentarios(
    planos.map((c) => ({
      ...c,
      like_count: contagem.get(c.id) ?? 0,
      liked: minhas.has(c.id),
    }))
  );
}

async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autorizado");
  return { supabase, user };
}

export async function uploadForumFile(
  formData: FormData
): Promise<{ url?: string; name?: string; error?: string }> {
  const { user } = await getAuthUser();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Arquivo obrigatório" };
  if (file.size > 10_485_760) return { error: "Arquivo muito grande (max 10MB)" };

  const fileType = formData.get("file_type") as string | null;
  const isAttachment = fileType === "file";

  const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const ALLOWED_FILE_MIME = [
    ...ALLOWED_IMAGE_MIME,
    "application/pdf",
    "application/zip",
    "application/x-zip-compressed",
    "application/x-rar-compressed",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/msword",
    "application/vnd.ms-excel",
    "text/plain",
  ];

  const allowed = isAttachment ? ALLOWED_FILE_MIME : ALLOWED_IMAGE_MIME;
  const mimeError = isAttachment
    ? "Tipo não permitido. Use: PDF, ZIP, RAR, DOCX, XLSX, PPTX, TXT ou imagem."
    : "Apenas imagens são permitidas (JPEG, PNG, WebP, GIF)";

  if (!allowed.includes(file.type)) return { error: mimeError };

  const service = createServiceClient();
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `forum/${user.id}/${Date.now()}.${ext}`;
  const { error } = await service.storage.from("community").upload(path, file, { upsert: false });
  if (error) return { error: "Erro ao fazer upload" };

  const { data: urlData } = service.storage.from("community").getPublicUrl(path);
  const isImage = file.type.startsWith("image/");
  return { url: urlData.publicUrl, name: isImage ? undefined : file.name };
}

const postSchema = z.object({
  title: z.string().min(5, "Título deve ter pelo menos 5 caracteres").max(200, "Título muito longo"),
  body: z.string().min(10, "Descrição deve ter pelo menos 10 caracteres").max(5000, "Máximo 5000 caracteres"),
});

export async function createForumPost(
  forumId: string,
  forumSlug: string,
  formData: FormData
): Promise<{ error?: string }> {
  const parsed = postSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { supabase, user } = await getAuthUser();

  const imageUrl = (formData.get("image_url") as string) || null;
  const attachmentUrl = (formData.get("attachment_url") as string) || null;
  const attachmentName = (formData.get("attachment_name") as string) || null;

  const { data: criado, error } = await supabase
    .from("forum_posts")
    .insert({
      forum_id: forumId,
      user_id: user.id,
      title: parsed.data.title,
      body: parsed.data.body,
      image_url: imageUrl,
      attachment_url: attachmentUrl,
      attachment_name: attachmentName,
      approved: false,
    })
    .select("id")
    .single();

  if (error) return { error: "Erro ao criar post" };

  // Aviso para a equipe. Nada avisava antes, e post que ninguém vê é post que
  // ninguém aprova — a aluna fica olhando o "aguardando aprovação" sem fim.
  //
  // O link vai para a moderação, não para o fórum: post novo nasce com
  // approved=false, e a tela do fórum só mostra post aprovado (ou da própria
  // autora). Mandar a equipe para lá seria mandá-la para uma página onde o post
  // não aparece. Na moderação os pendentes ficam no topo, e é lá que se aprova.
  //
  // `after` em vez de `await`: a aluna não fica olhando o botão girar enquanto
  // o Web Push sai para os três aparelhos da equipe. E `after` em vez de um
  // `void` solto porque o runtime pode congelar a função assim que a resposta
  // sai — o aviso morreria no meio, sem erro em lugar nenhum.
  if (criado?.id) {
    after(async () => {
      try {
        const service = createServiceClient();
        const { data: eu } = await service
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();

        await avisarAdminsDoForum({
          autorId: user.id,
          autorNome: (eu?.full_name as string) || "Uma aluna",
          tipo: "post",
          tituloDoPost: parsed.data.title,
          trecho: parsed.data.body,
          link: "/admin/comunidade/forum",
        });
      } catch (e) {
        console.error("[forum] aviso de post novo falhou:", e);
      }
    });
  }

  revalidatePath(`/comunidade/forum/${forumSlug}`);
  return {};
}

export async function deleteForumPost(
  postId: string,
  forumSlug: string
): Promise<{ error?: string }> {
  const { supabase, user } = await getAuthUser();

  const { error } = await supabase
    .from("forum_posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", user.id);

  if (error) return { error: "Erro ao deletar post" };
  revalidatePath(`/comunidade/forum/${forumSlug}`);
  return {};
}

// A URL vem de uploadForumFile, que já validou tipo e tamanho e devolveu um
// endereço público do nosso bucket. Aqui a gente confere que é isso mesmo: sem
// esta checagem, a Server Action aceitaria qualquer URL digitada por fora e o
// comentário viraria um caminho para tirar gente da plataforma.
// A primeira versão montava o prefixo com NEXT_PUBLIC_SUPABASE_URL. Em produção
// essa variável veio vazia neste ponto, o prefixo virou só o caminho, e aí
// NENHUMA imagem passava — "Imagem inválida" em toda resposta com foto.
//
// Agora a checagem olha a forma da URL, que é conhecida e não depende de
// ambiente: HTTPS, host de storage do Supabase, e o caminho público do nosso
// bucket. Quando a variável existe, ela entra como conferência extra do projeto.
const CAMINHO_DO_BUCKET = "/storage/v1/object/public/community/forum/";

/** URL que a gente mesma gerou no upload, e não um endereço qualquer. */
function urlDoNossoBucket(valor: string): boolean {
  let u: URL;
  try {
    u = new URL(valor);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  if (!u.hostname.endsWith(".supabase.co")) return false;
  if (!u.pathname.startsWith(CAMINHO_DO_BUCKET)) return false;

  // Se soubermos qual é o projeto, exigimos que seja ele. Se a variável não
  // estiver disponível aqui, as três checagens acima já seguram — e a aluna
  // não fica sem enviar por causa de configuração.
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (base) {
    try {
      if (new URL(base).hostname !== u.hostname) return false;
    } catch {
      /* variável malformada não invalida o envio */
    }
  }
  return true;
}

const anexoSchema = z.object({
  body: z.string().min(1, "Escreva sua resposta").max(2000, "Máximo 2000 caracteres"),
  imageUrl: z.string().refine(urlDoNossoBucket, "Imagem inválida").nullish(),
  attachmentUrl: z.string().refine(urlDoNossoBucket, "Anexo inválido").nullish(),
  attachmentName: z.string().max(200).nullish(),
});

/**
 * Dados do post que o aviso precisa: quem escreveu, o título e o slug do fórum
 * (sem o slug não dá para montar link que leve ao post exato).
 *
 * Service client de propósito: quem comenta pode não ter acesso de leitura ao
 * perfil de quem postou, e este join some com RLS.
 */
async function contextoDoPost(postId: string) {
  const service = createServiceClient();
  const { data: post } = await service
    .from("forum_posts")
    .select("title, user_id, forum_id")
    .eq("id", postId)
    .maybeSingle();
  if (!post) return null;

  const { data: forum } = await service
    .from("forums")
    .select("slug")
    .eq("id", post.forum_id as string)
    .maybeSingle();

  return {
    titulo: (post.title as string) ?? "um post do fórum",
    autorId: (post.user_id as string) ?? null,
    forumSlug: (forum?.slug as string) ?? null,
  };
}

export async function addForumComment(
  postId: string,
  body: string,
  anexos?: ForumCommentAnexos,
  parentId?: string | null
): Promise<ForumCommentRow | { error: string }> {
  const parsed = anexoSchema.safeParse({
    body,
    imageUrl: anexos?.imageUrl || null,
    attachmentUrl: anexos?.attachmentUrl || null,
    attachmentName: anexos?.attachmentName || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { supabase, user } = await getAuthUser();
  const service = createServiceClient();

  // ── A quem esta resposta pertence ──────────────────────────────────
  // parent_id vem do navegador: precisa ser um comentário que existe E que é
  // deste mesmo post, senão uma resposta poderia ser pendurada em outro post
  // (ou em coisa nenhuma) por quem forjasse o POST da Server Action.
  //
  // Se o pai não existe mais, a resposta entra como comentário de raiz em vez
  // de ser recusada — a aluna não perde o que acabou de escrever por causa de
  // um comentário apagado enquanto ela digitava.
  let paiId: string | null = null;
  let autorDoPai: string | null = null;
  if (parentId && z.string().uuid().safeParse(parentId).success) {
    const { data: pai } = await service
      .from("forum_comments")
      .select("id, user_id, post_id, parent_id")
      .eq("id", parentId)
      .maybeSingle();

    if (pai && pai.post_id === postId) {
      // Guarda o pai de verdade, mesmo quando ele já é uma resposta. O único
      // nível é de EXIBIÇÃO — `montarArvoreDeComentarios` acha a raiz do fio e
      // põe tudo na mesma altura.
      //
      // Achatar aqui, na escrita, parecia mais arrumado e estava errado: o
      // gatilho do banco avisa quem é dona de `parent_id`, então a resposta à
      // Fulana avisaria a dona do comentário lá de cima e a Fulana não saberia
      // de nada. Guardando o pai certo, sino e push falam com a mesma pessoa.
      paiId = pai.id as string;
      autorDoPai = (pai.user_id as string) ?? null;
    }
  }

  const { data, error } = await supabase
    .from("forum_comments")
    .insert({
      post_id: postId,
      parent_id: paiId,
      user_id: user.id,
      body: parsed.data.body,
      image_url: parsed.data.imageUrl ?? null,
      attachment_url: parsed.data.attachmentUrl ?? null,
      // Sem arquivo não faz sentido guardar nome; com arquivo e sem nome, um rótulo.
      attachment_name: parsed.data.attachmentUrl
        ? parsed.data.attachmentName || "Anexo"
        : null,
    })
    .select(CAMPOS_DO_COMENTARIO)
    .single();

  if (error) return { error: "Erro ao comentar" };

  const linha = data as unknown as ComentarioCru;
  const nome = linha.profiles?.full_name || "Uma aluna";

  // ── Avisos ─────────────────────────────────────────────────────────
  // O sino de quem recebe resposta é do gatilho `notify_on_comment_reply`, que
  // roda dentro do mesmo INSERT. Aqui sai só o push (o banco não tem como
  // falar com o Web Push) e o aviso da equipe. Inserir a notificação de novo
  // aqui daria dois sinos por comentário — foi assim que o feed duplicou em
  // set/2026.
  //
  // Tudo em `after`: a resposta da aluna aparece na tela na hora, e o aviso sai
  // depois com a função ainda viva (um `void` solto pode ser congelado no meio).
  after(async () => {
    try {
      const ctx = await contextoDoPost(postId);
      const link = ctx?.forumSlug
        ? linkDoPostNoForum(ctx.forumSlug, postId, linha.id)
        : "/comunidade/forum";
      const tituloDoPost = ctx?.titulo ?? "um post do fórum";

      const avisadosPeloGatilho = quemRecebeAvisoDeComentario({
        autorDoComentario: user.id,
        autorDoPost: ctx?.autorId ?? null,
        autorDoComentarioPai: autorDoPai,
      });

      await pushDeRespostaNoForum(avisadosPeloGatilho, {
        tituloDoPost,
        autorNome: nome,
        trecho: parsed.data.body,
        link,
      });

      await avisarAdminsDoForum({
        autorId: user.id,
        autorNome: nome,
        tipo: "comentario",
        tituloDoPost,
        trecho: parsed.data.body,
        link,
        jaAvisados: avisadosPeloGatilho,
      });
    } catch (e) {
      console.error("[forum] aviso de comentário falhou:", e);
    }
  });

  return { ...linha, like_count: 0, liked: false };
}

export async function deleteForumComment(commentId: string): Promise<{ error?: string }> {
  const { supabase, user } = await getAuthUser();

  const { error } = await supabase
    .from("forum_comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", user.id);

  if (error) return { error: "Erro ao deletar comentário" };
  return {};
}

/**
 * Curte ou descurte post OU comentário do fórum.
 *
 * `post_likes` já era polimórfica (target_type, target_id, user_id) e já
 * guardava 'forum_post' e 'news_post', mas esta função tinha 'forum_post'
 * escrito à mão em três lugares: não havia caminho nenhum para curtir um
 * comentário, e por isso eram 320 curtidas em post e zero em comentário.
 *
 * O tipo vem do navegador, então passa pelo allowlist antes de virar linha no
 * banco — a tabela não tem check constraint e aceitaria qualquer texto.
 */
export async function toggleForumLike(
  targetId: string,
  targetType: AlvoDeCurtida = "forum_post"
): Promise<{ liked: boolean; error?: string }> {
  const tipo = alvoDeCurtidaSchema.safeParse(targetType);
  if (!tipo.success) return { liked: false, error: "Alvo inválido" };

  const { supabase, user } = await getAuthUser();

  const { data: existing } = await supabase
    .from("post_likes")
    .select("user_id")
    .eq("target_type", tipo.data)
    .eq("target_id", targetId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("post_likes")
      .delete()
      .eq("target_type", tipo.data)
      .eq("target_id", targetId)
      .eq("user_id", user.id);
    return { liked: false };
  } else {
    await supabase
      .from("post_likes")
      .insert({ target_type: tipo.data, target_id: targetId, user_id: user.id });
    return { liked: true };
  }
}
