"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { sendNewCourseEmailBatch } from "@/lib/email";

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nao autorizado");
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Nao autorizado");
  return supabase;
}

// ─── Thumbnail ────────────────────────────────────────────────────────────────

export async function uploadCourseThumbnail(
  formData: FormData
): Promise<{ url?: string; error?: string }> {
  await assertAdmin();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Arquivo obrigatorio" };
  if (file.size > 10_485_760) return { error: "Imagem muito grande (max 10MB)" };
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    return { error: "Formato invalido. Use JPG, PNG ou WebP" };

  const ext = file.type === "image/webp" ? "webp" : file.type === "image/png" ? "png" : "jpg";
  const path = `${Date.now()}.${ext}`;
  const buffer = new Uint8Array(await file.arrayBuffer());

  const service = createServiceClient();
  const { error: uploadError } = await service.storage
    .from("course-thumbnails")
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploadError) return { error: "Erro no upload: " + uploadError.message };

  const { data: { publicUrl } } = service.storage
    .from("course-thumbnails")
    .getPublicUrl(path);

  return { url: publicUrl };
}

// ─── Categorias ───────────────────────────────────────────────────────────────

export async function createCategory(
  name: string
): Promise<{ id?: string; name?: string; error?: string }> {
  const supabase = await assertAdmin();
  if (!name.trim()) return { error: "Nome obrigatorio" };
  const slug = name.trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const { data, error } = await supabase
    .from("categories")
    .insert({ name: name.trim(), slug })
    .select("id, name")
    .single();

  if (error) return { error: "Erro ao criar categoria: " + error.message };
  revalidatePath("/admin/cursos");
  return { id: data.id, name: data.name };
}

export async function updateCategory(
  id: string,
  name: string
): Promise<{ error?: string }> {
  const supabase = await assertAdmin();
  if (!name.trim()) return { error: "Nome obrigatorio" };
  const slug = name.trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const { error } = await supabase
    .from("categories")
    .update({ name: name.trim(), slug })
    .eq("id", id);

  if (error) return { error: "Erro ao atualizar: " + error.message };
  revalidatePath("/admin/cursos");
  return {};
}

export async function deleteCategory(
  id: string
): Promise<{ error?: string }> {
  const supabase = await assertAdmin();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { error: "Erro ao excluir: " + error.message };
  revalidatePath("/admin/cursos");
  return {};
}

// ─── Nichos ───────────────────────────────────────────────────────────────────

export async function createNiche(
  name: string
): Promise<{ id?: string; name?: string; error?: string }> {
  const supabase = await assertAdmin();
  if (!name.trim()) return { error: "Nome obrigatorio" };
  const slug = name.trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const service = createServiceClient();
  const { data: maxPos } = await service
    .from("niches").select("position").order("position", { ascending: false }).limit(1).single();
  const position = (maxPos?.position ?? 0) + 1;

  const { data, error } = await supabase
    .from("niches")
    .insert({ name: name.trim(), slug, active: true, position })
    .select("id, name")
    .single();

  if (error) return { error: "Erro ao criar nicho: " + error.message };
  revalidatePath("/admin/cursos");
  revalidatePath("/ferramentas/fornecedores");
  return { id: data.id, name: data.name };
}

export async function updateNiche(
  id: string,
  name: string
): Promise<{ error?: string }> {
  const supabase = await assertAdmin();
  if (!name.trim()) return { error: "Nome obrigatorio" };
  const slug = name.trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const { error } = await supabase
    .from("niches")
    .update({ name: name.trim(), slug })
    .eq("id", id);

  if (error) return { error: "Erro ao atualizar: " + error.message };
  revalidatePath("/admin/cursos");
  revalidatePath("/ferramentas/fornecedores");
  return {};
}

export async function deleteNiche(
  id: string
): Promise<{ error?: string }> {
  const supabase = await assertAdmin();
  const { error } = await supabase.from("niches").delete().eq("id", id);
  if (error) return { error: "Erro ao excluir: " + error.message };
  revalidatePath("/admin/cursos");
  revalidatePath("/ferramentas/fornecedores");
  return {};
}

// ─── Cursos ───────────────────────────────────────────────────────────────────

const CourseSchema = z.object({
  title: z.string().min(3).max(200),
  slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/, "Slug: apenas letras minusculas, numeros e hifens"),
  description: z.string().max(5000).optional().default(""),
  price: z.number().min(0),
  checkout_codes: z.array(z.string().max(100)).default([]),
  workload_hours: z.number().min(0).max(9999),
  course_type: z.enum(["course", "material"]).default("course"),
  in_plan: z.boolean().default(false),
  has_certificate: z.boolean().default(false),
  published: z.boolean().default(false),
  category_id: z.string().uuid().nullable().optional(),
  forum_id: z.string().uuid().nullable().optional(),
  niche_id: z.string().uuid().nullable().optional(),
  thumbnail_url: z.string().optional().nullable(),
  checkout_url: z.string().url().nullable().optional(),
});

export async function createCourse(
  formData: FormData
): Promise<{ error?: string; courseId?: string }> {
  const supabase = await assertAdmin();

  const raw = {
    title: formData.get("title") as string,
    slug: formData.get("slug") as string,
    description: formData.get("description") as string,
    price: Number(formData.get("price") ?? 0),
    checkout_codes: (formData.get("checkout_codes") as string ?? "")
      .split(",").map((s) => s.trim()).filter(Boolean),
    workload_hours: Number(formData.get("workload_hours") ?? 0),
    course_type: (formData.get("course_type") as string) || "course",
    in_plan: formData.get("in_plan") === "true",
    has_certificate: formData.get("has_certificate") === "true",
    published: false,
    category_id: (formData.get("category_id") as string) || null,
    forum_id: (formData.get("forum_id") as string) || null,
    niche_id: (formData.get("niche_id") as string) || null,
    thumbnail_url: (formData.get("thumbnail_url") as string) || null,
    checkout_url: (formData.get("checkout_url") as string)?.trim() || null,
  };

  const parsed = CourseSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data, error } = await supabase
    .from("courses").insert(parsed.data).select("id").single();

  if (error) return { error: "Erro ao criar curso: " + error.message };
  revalidatePath("/admin/cursos");
  return { courseId: data.id };
}

export async function updateCourse(
  courseId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await assertAdmin();

  const raw = {
    title: formData.get("title") as string,
    slug: formData.get("slug") as string,
    description: formData.get("description") as string,
    price: Number(formData.get("price") ?? 0),
    checkout_codes: (formData.get("checkout_codes") as string ?? "")
      .split(",").map((s) => s.trim()).filter(Boolean),
    workload_hours: Number(formData.get("workload_hours") ?? 0),
    course_type: (formData.get("course_type") as string) || "course",
    in_plan: formData.get("in_plan") === "true",
    has_certificate: formData.get("has_certificate") === "true",
    published: formData.get("published") === "true",
    category_id: (formData.get("category_id") as string) || null,
    forum_id: (formData.get("forum_id") as string) || null,
    niche_id: (formData.get("niche_id") as string) || null,
    thumbnail_url: (formData.get("thumbnail_url") as string) || null,
    checkout_url: (formData.get("checkout_url") as string)?.trim() || null,
  };

  const parsed = CourseSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await supabase.from("courses").update(parsed.data).eq("id", courseId);
  if (error) return { error: "Erro ao atualizar: " + error.message };

  // A segunda porta de publicação. O formulário tem a caixa "Publicado", então
  // dava para pôr um curso no ar por aqui sem anúncio nenhum, enquanto o botão
  // da lista anunciava — duas portas, dois comportamentos. Agora as duas passam
  // pela mesma trava de `announced_at`, e é ela (não o caminho) que decide se o
  // e-mail sai. Salvar um curso antigo cai na primeira consulta e volta sem
  // mandar nada, porque a migration carimbou todos os cursos existentes.
  if (parsed.data.published) {
    const { data: { user } } = await supabase.auth.getUser();
    after(() => announceCourse(courseId, user?.id ?? null));
  }

  revalidatePath("/admin/cursos");
  revalidatePath(`/admin/cursos/${courseId}`);
  revalidatePath(`/cursos/${raw.slug}`);
  return {};
}

export async function togglePublished(courseId: string, published: boolean): Promise<void> {
  const supabase = await assertAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("courses").update({ published }).eq("id", courseId);
  revalidatePath("/admin/cursos");

  await createServiceClient().from("audit_log").insert({
    admin_id: user?.id ?? null,
    action: published ? "course.published" : "course.unpublished",
    target_type: "course",
    target_id: courseId,
    meta: {},
  });

  if (!published) return;

  // `after` em vez de `void`: o `void` era disparo ao vento dentro de uma
  // Server Action — o runtime pode congelar a função assim que a resposta sai,
  // no meio do envio. Com `after`, a Vercel mantém a função viva depois da
  // resposta e a admin continua sem esperar pelo clique.
  after(() => announceCourse(courseId, user?.id ?? null));
}

/**
 * Anuncia o curso para a base — UMA vez por curso.
 *
 * Antes, toda transição de `published` para true reenviava "Novo curso na
 * Handify" para as 4.555 alunas opt-in: despublicar e republicar (dois cliques
 * no mesmo botão) mandava tudo de novo, e nada registrava o primeiro envio.
 *
 * São três travas, em camadas:
 *
 * 1. `courses.announced_at` — o update condicional abaixo é ao mesmo tempo a
 *    marcação e o cadeado. Quem perde a corrida (segundo clique, ou o outro
 *    caminho de publicação) recebe zero linhas e sai sem mandar nada;
 * 2. `email_campaign_sends` por pessoa — se um envio morrer no meio e alguém
 *    reanunciar de propósito (limpando `announced_at`), quem já recebeu não
 *    recebe outra vez;
 * 3. o registro é gravado LOTE A LOTE, não no fim. Se a função for cortada na
 *    metade, o que já saiu está registrado e a retomada continua de onde parou
 *    em vez de recomeçar do zero.
 */
async function announceCourse(courseId: string, adminId: string | null) {
  try {
    const service = createServiceClient();

    const { data: reivindicado, error: erroClaim } = await service
      .from("courses")
      .update({ announced_at: new Date().toISOString() })
      .eq("id", courseId)
      .is("announced_at", null)
      .select("id, title, slug, description, thumbnail_url");

    if (erroClaim) throw new Error(`claim de announced_at: ${erroClaim.message}`);

    const course = reivindicado?.[0];
    if (!course) return; // já anunciado, ou outro clique pegou primeiro

    const campanha = `novo-curso-${courseId}`;

    // O PostgREST corta em 1.000 sem erro e são 4.558 alunas — 78% da base
    // ficava de fora do anúncio "legítimo", e sem `order` as 1.000 que vinham
    // eram arbitrárias.
    const jaReceberam = new Set(
      (
        await fetchAll<{ user_id: string }>((de, ate) =>
          service
            .from("email_campaign_sends")
            .select("user_id")
            .eq("campaign", campanha)
            .order("user_id")
            .range(de, ate)
        )
      ).map((r) => r.user_id)
    );

    type Perfil = {
      id: string;
      full_name: string | null;
      email: string;
      email_prefs: Record<string, boolean> | null;
      banned: boolean | null;
    };
    const perfis = await fetchAll<Perfil>((de, ate) =>
      service
        .from("profiles")
        .select("id, full_name, email, email_prefs, banned")
        .eq("role", "student")
        .not("email", "is", null)
        .order("id")
        .range(de, ate)
    );

    const elegiveis = perfis.filter(
      (p) =>
        // banida não recebe — mesma regra do `podeReceber()` das campanhas.
        !p.banned &&
        // null = opt-in, igual hoje.
        p.email_prefs?.new_course !== false &&
        !jaReceberam.has(p.id)
    );
    if (!elegiveis.length) return;

    let enviadosTotal = 0;
    let registradosTotal = 0;
    let erroFinal: string | null = null;

    for (let i = 0; i < elegiveis.length; i += 100) {
      const fatia = elegiveis.slice(i, i + 100);
      const { enviados, erro } = await sendNewCourseEmailBatch(
        fatia.map((p) => ({
          to: p.email,
          studentName: p.full_name ?? "Aluna",
          courseTitle: course.title,
          courseSlug: course.slug,
          courseDescription: course.description ?? undefined,
          thumbnailUrl: course.thumbnail_url,
        }))
      );
      enviadosTotal += enviados.length;

      // Só registra quem a Resend aceitou. Endereço suprimido é cortado antes
      // do lote, não vira registro, e será reavaliado (e cortado de novo) num
      // eventual reenvio — que é o correto.
      const aceitos = new Set(enviados.map((e) => e.toLowerCase()));
      const registros = fatia
        .filter((p) => aceitos.has(p.email.toLowerCase()))
        .map((p) => ({ campaign: campanha, user_id: p.id, email: p.email }));

      if (registros.length) {
        const { error: erroRegistro } = await service
          .from("email_campaign_sends")
          .upsert(registros, { onConflict: "campaign,user_id" });
        if (erroRegistro) {
          // Sem registro não há trava de repetição. Parar e gritar é melhor do
          // que seguir enviando sem saber para quem já foi.
          erroFinal = `falha ao registrar envio: ${erroRegistro.message}`;
          console.error("[announceCourse] FALHA AO REGISTRAR ENVIO:", erroRegistro.message);
          break;
        }
        registradosTotal += registros.length;
      }

      if (erro) {
        erroFinal = erro;
        console.error("[announceCourse] lote interrompido:", erro);
        break;
      }
    }

    await service.from("audit_log").insert({
      admin_id: adminId,
      action: "course.announced",
      target_type: "course",
      target_id: courseId,
      meta: {
        course_title: course.title,
        publico: elegiveis.length,
        enviados: enviadosTotal,
        registrados: registradosTotal,
        erro: erroFinal,
      },
    });

    console.info(
      `[announceCourse] ${course.title}: ${enviadosTotal}/${elegiveis.length} enviados, ${registradosTotal} registrados${erroFinal ? ` — interrompido: ${erroFinal}` : ""}`
    );
  } catch (e) {
    console.error("[announceCourse]", e);
  }
}

export async function reorderCourses(courseIds: string[]): Promise<{ error?: string }> {
  const supabase = await assertAdmin();
  await Promise.all(
    courseIds.map((id, i) => supabase.from("courses").update({ position: i }).eq("id", id))
  );
  revalidatePath("/admin/cursos");
  revalidatePath("/cursos");
  return {};
}

// ─── Exclusão de curso ────────────────────────────────────────────────────────

export type CourseDeletionImpact = {
  title: string;
  enrollments: number;
  certificates: number;
  modules: number;
  lessons: number;
  forumPosts: number;
  error?: string;
};

/** Conta o que a cascata levaria junto. Só leitura — não apaga nada. */
export async function getCourseDeletionImpact(
  courseId: string
): Promise<CourseDeletionImpact> {
  await assertAdmin();
  const service = createServiceClient();

  const { data: course } = await service
    .from("courses").select("title").eq("id", courseId).single();
  if (!course) {
    return { title: "", enrollments: 0, certificates: 0, modules: 0, lessons: 0, forumPosts: 0, error: "Curso nao encontrado." };
  }

  // `count: exact` + `head`: uma consulta, zero linhas na memória, e o total
  // não vem cortado no teto de 1.000 do PostgREST.
  const [enr, cert, fp, mods] = await Promise.all([
    service.from("enrollments").select("id", { count: "exact", head: true }).eq("course_id", courseId),
    service.from("certificates").select("id", { count: "exact", head: true }).eq("course_id", courseId),
    service.from("forum_posts").select("id", { count: "exact", head: true }).eq("course_id", courseId),
    service.from("modules").select("id").eq("course_id", courseId),
  ]);

  const moduleIds = (mods.data ?? []).map((m) => m.id as string);
  let lessons = 0;
  if (moduleIds.length) {
    const { count } = await service
      .from("lessons").select("id", { count: "exact", head: true }).in("module_id", moduleIds);
    lessons = count ?? 0;
  }

  return {
    title: course.title as string,
    enrollments: enr.count ?? 0,
    certificates: cert.count ?? 0,
    modules: moduleIds.length,
    lessons,
    forumPosts: fp.count ?? 0,
  };
}

/**
 * Apagar curso cascateia em `enrollments`, `certificates` e
 * `modules` → `lessons` → `lesson_progress`: o progresso de cada aluna vai
 * junto, sem volta. O botão da lixeira fica na mesma linha do lápis de editar,
 * e o único aviso dizia "Esta ação é irreversível", sem citar matrícula nem
 * certificado. "Curso Saponária Brasil" sozinho são 3.196 matrículas e 140
 * certificados.
 *
 * Por isso: curso com matrícula ou certificado não se apaga — despublica-se
 * (`published = false` já tira o curso da aluna sem destruir nada). E todo
 * delete que acontece deixa retrato no `audit_log` ANTES das linhas sumirem;
 * depois delas não dá nem para montar a lista de quem precisa ser remendada.
 *
 * `force` existe como porta de emergência consciente, por chamada direta.
 * Nenhuma UI passa `true`.
 */
export async function deleteCourse(
  courseId: string,
  force = false
): Promise<{ error?: string }> {
  const supabase = await assertAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  const adminId = user?.id ?? null;

  const service = createServiceClient();

  const { data: course } = await service
    .from("courses")
    .select("title, slug, published, checkout_codes")
    .eq("id", courseId)
    .single();
  if (!course) return { error: "Curso nao encontrado." };

  const impacto = await getCourseDeletionImpact(courseId);
  if (impacto.error) return { error: impacto.error };

  if (!force && (impacto.enrollments > 0 || impacto.certificates > 0)) {
    return {
      error:
        `"${impacto.title}" tem ${impacto.enrollments} matricula(s) e ${impacto.certificates} certificado(s). ` +
        `Apagar levaria tudo junto, incluindo o progresso das aulas, sem volta. ` +
        `Para tirar o curso do ar sem perder nada, despublique em vez de excluir.`,
    };
  }

  // Paginado: sem isto a lista para em 1.000 e o retrato mente sobre quem
  // perdeu acesso justamente no curso grande, que é onde ela importa.
  const matriculadas = await fetchAll<{ user_id: string }>((de, ate) =>
    service.from("enrollments").select("user_id").eq("course_id", courseId).range(de, ate)
  );
  const certificadas = await fetchAll<{ user_id: string }>((de, ate) =>
    service.from("certificates").select("user_id").eq("course_id", courseId).range(de, ate)
  );

  const retrato = {
    title: course.title,
    slug: course.slug,
    published: course.published,
    checkout_codes: course.checkout_codes ?? [],
    enrollments_count: impacto.enrollments,
    certificates_count: impacto.certificates,
    modules_count: impacto.modules,
    lessons_count: impacto.lessons,
    forum_posts_count: impacto.forumPosts,
    enrolled_user_ids: matriculadas.map((e) => e.user_id),
    certificate_user_ids: certificadas.map((c) => c.user_id),
    forced: force,
  };

  await service.from("audit_log").insert({
    admin_id: adminId,
    action: "course.deleted",
    target_type: "course",
    target_id: courseId,
    meta: retrato,
  });

  const { error } = await supabase.from("courses").delete().eq("id", courseId);
  if (error) {
    // O retrato acima ficou dizendo que apagou. Desmente na linha seguinte.
    await service.from("audit_log").insert({
      admin_id: adminId,
      action: "course.delete_failed",
      target_type: "course",
      target_id: courseId,
      meta: { title: course.title, error: error.message },
    });
    return { error: "Erro ao excluir: " + error.message };
  }

  revalidatePath("/admin/cursos");
  revalidatePath("/cursos");
  return {};
}

// ─── Matrícula retroativa ─────────────────────────────────────────────────────

/**
 * Concede acesso ao curso para quem já pagou por ele e ainda não tem matrícula
 * ativa. É a ferramenta de reparo: existe para o dia em que o webhook falha.
 *
 * Quem decide *quem* tem direito é a RPC `alunas_para_matricula_retroativa`.
 * A pergunta mudou de lugar de propósito — em TypeScript ela estava errada de
 * cinco jeitos que se escondiam um atrás do outro:
 *
 * - o `select` em `payment_events` não paginava, e o PostgREST corta em 1.000
 *   sem erro: para o curso maior, a ferramenta via 1.000 de 3.171 eventos;
 * - casava só por `payment_events.product_code`, que guarda apenas o produto
 *   principal — item de produto agrupado e order bump ficavam invisíveis;
 * - casava pelo código do GRUPO, liberando curso que o kit não inclui;
 * - não excluía transação estornada;
 * - exigia `processed = true`, ou seja, ignorava exatamente os eventos que
 *   falharam — os únicos que precisam de reparo.
 *
 * Atenção ao mexer: o filtro de estorno e o `expires_at` da checagem de
 * matrícula são um par. Hoje os dois defeitos antigos se anulavam por acidente
 * (a linha revogada contava como "já matriculada" e barrava o reembolso).
 * Corrigir só um dos dois devolve acesso que o estorno tirou.
 */
export async function retroactiveEnroll(
  courseId: string
): Promise<{ count: number; error?: string; parcial?: boolean }> {
  const supabase = await assertAdmin();
  const { data: { user: admin } } = await supabase.auth.getUser();
  const service = createServiceClient();

  const { data: course } = await service
    .from("courses")
    .select("access_days, checkout_codes, in_plan")
    .eq("id", courseId)
    .single();

  if (!course) return { count: 0, error: "Curso nao encontrado." };
  if (!course.checkout_codes?.length && !course.in_plan) {
    return { count: 0, error: "Curso sem checkout codes configurados." };
  }

  // 500 fica abaixo do teto de 1.000 do PostgREST, então o retorno nunca vem
  // truncado em silêncio; quando bate no limite a action avisa (`parcial`).
  const LIMITE = 500;
  const { data: alunas, error: rpcErr } = await service.rpc(
    "alunas_para_matricula_retroativa",
    { p_course_id: courseId, p_limite: LIMITE }
  );

  if (rpcErr) return { count: 0, error: rpcErr.message };
  if (!alunas?.length) return { count: 0 };

  const expiresAt = course.access_days
    ? (() => {
        const d = new Date();
        d.setDate(d.getDate() + (course.access_days as number));
        return d.toISOString();
      })()
    : null;

  const now = new Date().toISOString();

  // `upsert`, não `insert`: a aluna pode ter linha expirada ou revogada, e a
  // RPC já decidiu que ela tem direito (compra em pé, não estornada).
  const { error: insertErr } = await service.from("enrollments").upsert(
    (alunas as { user_id: string; email: string }[]).map((a) => ({
      user_id: a.user_id,
      course_id: courseId,
      // "manual" é o valor honesto: quem concedeu foi a admin, e a compra pode
      // ter vindo da Kiwify. "payt" mentia em todo caso vindo da outra
      // plataforma.
      source: "manual",
      granted_at: now,
      expires_at: expiresAt,
    })),
    { onConflict: "user_id,course_id" }
  );

  if (insertErr) return { count: 0, error: insertErr.message };

  // Queima o token SÓ de quem terminou com matrícula. Antes a lista era todo
  // mundo que pagou — inclusive quem nunca criou conta, que nunca é matriculada
  // aqui. Token queimado sem matrícula deixa o link respondendo "já foi
  // utilizado" e tira a aluna da aba "Sem cadastro" e do relatório
  // `compras_sem_acesso`, que partem de `used = false`: ela fica sem o curso e
  // sem nenhuma porta de saída.
  const emailsMatriculadas = (alunas as { email: string | null }[])
    .map((a) => a.email?.toLowerCase())
    .filter((e): e is string => !!e);

  if (emailsMatriculadas.length) {
    await service
      .from("activation_tokens")
      .update({ used: true })
      .eq("course_id", courseId)
      .in("email", emailsMatriculadas)
      .eq("used", false);
  }

  await service.from("audit_log").insert({
    admin_id: admin?.id ?? null,
    action: "enrollment.retroactive",
    target_type: "course",
    target_id: courseId,
    meta: {
      course_id: courseId,
      concedidas: alunas.length,
      user_ids: (alunas as { user_id: string }[]).map((a) => a.user_id),
      limite: LIMITE,
      parcial: alunas.length === LIMITE,
    },
  });

  revalidatePath("/admin/cursos");

  return { count: alunas.length, parcial: alunas.length === LIMITE };
}
