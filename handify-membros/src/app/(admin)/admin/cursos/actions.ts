"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sendNewCourseEmail } from "@/lib/email";

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
  product_codes: z.array(z.string().max(100)).default([]),
  workload_hours: z.number().min(0).max(9999),
  course_type: z.enum(["course", "material"]).default("course"),
  is_subscription_only: z.boolean().default(false),
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
    product_codes: (formData.get("product_codes") as string ?? "")
      .split(",").map((s) => s.trim()).filter(Boolean),
    workload_hours: Number(formData.get("workload_hours") ?? 0),
    course_type: (formData.get("course_type") as string) || "course",
    is_subscription_only: formData.get("is_subscription_only") === "true",
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
    product_codes: (formData.get("product_codes") as string ?? "")
      .split(",").map((s) => s.trim()).filter(Boolean),
    workload_hours: Number(formData.get("workload_hours") ?? 0),
    course_type: (formData.get("course_type") as string) || "course",
    is_subscription_only: formData.get("is_subscription_only") === "true",
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

  revalidatePath("/admin/cursos");
  revalidatePath(`/admin/cursos/${courseId}`);
  revalidatePath(`/cursos/${raw.slug}`);
  return {};
}

export async function togglePublished(courseId: string, published: boolean): Promise<void> {
  const supabase = await assertAdmin();
  await supabase.from("courses").update({ published }).eq("id", courseId);
  revalidatePath("/admin/cursos");

  if (!published) return;

  // Ao publicar: notificar alunas que optaram por e-mail de novos cursos
  void notifyNewCourse(courseId);
}

async function notifyNewCourse(courseId: string) {
  try {
    const service = createServiceClient();
    const { data: course } = await service
      .from("courses")
      .select("title, slug, description, thumbnail_url")
      .eq("id", courseId)
      .single();
    if (!course) return;

    // Busca perfis com new_course != false (null = opt-in por padrão)
    const { data: profiles } = await service
      .from("profiles")
      .select("full_name, email, email_prefs")
      .eq("role", "student")
      .not("email", "is", null);

    if (!profiles?.length) return;

    const eligible = profiles.filter(
      (p) => (p.email_prefs as Record<string, boolean> | null)?.new_course !== false
    );

    for (const p of eligible) {
      await sendNewCourseEmail({
        to: p.email,
        studentName: p.full_name ?? "Aluna",
        courseTitle: course.title,
        courseSlug: course.slug,
        courseDescription: course.description ?? undefined,
        thumbnailUrl: course.thumbnail_url,
      });
    }
  } catch (e) {
    console.error("[email] notifyNewCourse:", e);
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

export async function deleteCourse(courseId: string): Promise<void> {
  const supabase = await assertAdmin();
  const { error } = await supabase.from("courses").delete().eq("id", courseId);
  if (error) throw new Error("Erro ao excluir: " + error.message);
  revalidatePath("/admin/cursos");
  redirect("/admin/cursos");
}

// ─── Matrícula retroativa ─────────────────────────────────────────────────────

/**
 * Concede acesso ao curso para todas as alunas que já pagaram por qualquer
 * um dos product_codes configurados no curso mas ainda não têm matrícula.
 * Também consome activation_tokens não utilizados para esses cursos/e-mails.
 */
export async function retroactiveEnroll(
  courseId: string
): Promise<{ count: number; error?: string }> {
  await assertAdmin();
  const service = createServiceClient();

  // 1. Pegar product_codes e access_days do curso
  const { data: course } = await service
    .from("courses")
    .select("product_codes, access_days")
    .eq("id", courseId)
    .single();

  if (!course?.product_codes?.length) {
    return { count: 0, error: "Curso sem product codes configurados." };
  }

  const grantStatuses = ["paid", "approved", "completed", "confirmed"];

  // 2. Buscar e-mails de quem pagou por qualquer product_code do curso
  const { data: events, error: evErr } = await service
    .from("payment_events")
    .select("buyer_email")
    .in("product_code", course.product_codes as string[])
    .in("event_type", grantStatuses)
    .eq("processed", true);

  if (evErr) return { count: 0, error: evErr.message };
  if (!events?.length) return { count: 0 };

  const emails = [...new Set(events.map((e) => e.buyer_email.toLowerCase()))];

  // 3. Buscar perfis dessas alunas (só quem já criou conta)
  const { data: profiles } = await service
    .from("profiles")
    .select("id")
    .in("email", emails);

  if (!profiles?.length) return { count: 0 };

  const userIds = profiles.map((p) => p.id);

  // 4. Checar quem já tem matrícula ativa (sem expiração ou expirada no futuro)
  const { data: existing } = await service
    .from("enrollments")
    .select("user_id")
    .eq("course_id", courseId)
    .in("user_id", userIds);

  const enrolledSet = new Set(existing?.map((e) => e.user_id) ?? []);
  const toEnroll = userIds.filter((id) => !enrolledSet.has(id));

  if (!toEnroll.length) return { count: 0 };

  // 5. Calcular expiração (null = vitalício)
  const expiresAt = course.access_days
    ? (() => {
        const d = new Date();
        d.setDate(d.getDate() + (course.access_days as number));
        return d.toISOString();
      })()
    : null;

  const now = new Date().toISOString();

  const { error: insertErr } = await service.from("enrollments").insert(
    toEnroll.map((userId) => ({
      user_id: userId,
      course_id: courseId,
      source: "payt",
      granted_at: now,
      expires_at: expiresAt,
    }))
  );

  if (insertErr) return { count: 0, error: insertErr.message };

  // 6. Marcar activation_tokens pendentes desse curso/e-mails como usados
  await service
    .from("activation_tokens")
    .update({ used: true })
    .eq("course_id", courseId)
    .in("email", emails)
    .eq("used", false);

  revalidatePath("/admin/cursos");

  return { count: toEnroll.length };
}
