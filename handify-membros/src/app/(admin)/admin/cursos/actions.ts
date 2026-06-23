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

// ─── Cursos ───────────────────────────────────────────────────────────────────

const CourseSchema = z.object({
  title: z.string().min(3).max(200),
  slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/, "Slug: apenas letras minusculas, numeros e hifens"),
  description: z.string().max(5000).optional().default(""),
  price: z.number().min(0),
  product_code: z.string().max(100).optional().default(""),
  workload_hours: z.number().min(0).max(9999),
  course_type: z.enum(["course", "material"]).default("course"),
  is_subscription_only: z.boolean().default(false),
  has_certificate: z.boolean().default(false),
  published: z.boolean().default(false),
  category_id: z.string().uuid().nullable().optional(),
  forum_id: z.string().uuid().nullable().optional(),
  thumbnail_url: z.string().optional().nullable(),
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
    product_code: formData.get("product_code") as string,
    workload_hours: Number(formData.get("workload_hours") ?? 0),
    course_type: (formData.get("course_type") as string) || "course",
    is_subscription_only: formData.get("is_subscription_only") === "true",
    has_certificate: formData.get("has_certificate") === "true",
    published: false,
    category_id: (formData.get("category_id") as string) || null,
    forum_id: (formData.get("forum_id") as string) || null,
    thumbnail_url: (formData.get("thumbnail_url") as string) || null,
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
    product_code: formData.get("product_code") as string,
    workload_hours: Number(formData.get("workload_hours") ?? 0),
    course_type: (formData.get("course_type") as string) || "course",
    is_subscription_only: formData.get("is_subscription_only") === "true",
    has_certificate: formData.get("has_certificate") === "true",
    published: formData.get("published") === "true",
    category_id: (formData.get("category_id") as string) || null,
    forum_id: (formData.get("forum_id") as string) || null,
    thumbnail_url: (formData.get("thumbnail_url") as string) || null,
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

export async function deleteCourse(courseId: string): Promise<void> {
  const supabase = await assertAdmin();
  const { error } = await supabase.from("courses").delete().eq("id", courseId);
  if (error) throw new Error("Erro ao excluir: " + error.message);
  revalidatePath("/admin/cursos");
  redirect("/admin/cursos");
}
