"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";
import { z } from "zod";

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nao autorizado");
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Nao autorizado");
  return supabase;
}

// ─── Tipos compartilhados ─────────────────────────────────────────────────────

const LESSON_TYPES = ["video", "document", "html", "link", "mixed"] as const;
type LessonType = typeof LESSON_TYPES[number];
export type { LessonType };

export interface LessonMaterial { id: string; name: string; file_path: string }
export interface LessonData {
  id: string; title: string; position: number;
  lesson_type: LessonType; is_preview: boolean; archived: boolean;
  duration_seconds: number | null; video_panda_id: string | null;
  description: string | null; materials: LessonMaterial[];
}

// ─── Módulos ──────────────────────────────────────────────────────────────────

const ModuleSchema = z.object({
  title: z.string().min(1).max(200),
  position: z.number().int().min(0),
});

export async function createModule(
  courseId: string,
  formData: FormData
): Promise<{ error?: string; module?: { id: string; title: string; position: number; archived: boolean } }> {
  const supabase = await assertAdmin();
  const raw = {
    title: formData.get("title") as string,
    position: Number(formData.get("position") ?? 0),
  };
  const parsed = ModuleSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data, error } = await supabase
    .from("modules")
    .insert({ ...parsed.data, course_id: courseId })
    .select("id, title, position, archived")
    .single();

  if (error) return { error: "Erro ao criar modulo: " + error.message };
  revalidatePath(`/admin/cursos/${courseId}`);
  return { module: data };
}

export async function updateModule(
  moduleId: string,
  courseId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await assertAdmin();
  const raw = {
    title: formData.get("title") as string,
    position: Number(formData.get("position") ?? 0),
  };
  const parsed = ModuleSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await supabase.from("modules").update(parsed.data).eq("id", moduleId);
  if (error) return { error: "Erro ao atualizar modulo: " + error.message };
  revalidatePath(`/admin/cursos/${courseId}`);
  return {};
}

export async function deleteModule(
  moduleId: string,
  courseId: string
): Promise<{ error?: string }> {
  const supabase = await assertAdmin();
  const { error } = await supabase.from("modules").delete().eq("id", moduleId);
  if (error) return { error: "Erro ao excluir modulo: " + error.message };
  revalidatePath(`/admin/cursos/${courseId}`);
  return {};
}

export async function toggleArchivedModule(
  moduleId: string,
  courseId: string,
  archived: boolean
): Promise<{ error?: string }> {
  const supabase = await assertAdmin();
  const { error } = await supabase.from("modules").update({ archived }).eq("id", moduleId);
  if (error) return { error: "Erro ao arquivar modulo: " + error.message };
  revalidatePath(`/admin/cursos/${courseId}`);
  return {};
}

// ─── Aulas ────────────────────────────────────────────────────────────────────

const LessonSchema = z.object({
  title: z.string().min(1).max(200),
  lesson_type: z.enum(LESSON_TYPES).default("video"),
  video_panda_id: z.string().max(200).optional().default(""),
  duration_seconds: z.number().int().min(0).default(0),
  is_preview: z.boolean().default(false),
  position: z.number().int().min(0),
  description: z.string().max(10000).optional().default(""),
});

async function fetchLessonWithMaterials(supabase: Awaited<ReturnType<typeof createClient>>, lessonId: string): Promise<LessonData | null> {
  const { data, error } = await supabase
    .from("lessons")
    .select("id, title, position, lesson_type, is_preview, archived, duration_seconds, video_panda_id, description, lesson_materials(id, name, file_path)")
    .eq("id", lessonId)
    .single();

  if (error) {
    // archived column missing → migration 008 not applied yet; retry without it
    if (error.message.includes("archived")) {
      const { data: d2 } = await supabase
        .from("lessons")
        .select("id, title, position, lesson_type, is_preview, duration_seconds, video_panda_id, description, lesson_materials(id, name, file_path)")
        .eq("id", lessonId)
        .single();
      if (!d2) return null;
      const { lesson_materials, ...lesson } = d2 as typeof d2 & { lesson_materials: LessonMaterial[] };
      return { ...lesson, lesson_type: lesson.lesson_type as LessonType, archived: false, materials: lesson_materials ?? [] };
    }
    return null;
  }

  if (!data) return null;
  const { lesson_materials, ...lesson } = data as typeof data & { lesson_materials: LessonMaterial[] };
  return { ...lesson, lesson_type: lesson.lesson_type as LessonType, materials: lesson_materials ?? [] };
}

export async function createLesson(
  moduleId: string,
  courseId: string,
  formData: FormData
): Promise<{ error?: string; lesson?: LessonData }> {
  const supabase = await assertAdmin();
  const raw = {
    title: formData.get("title") as string,
    lesson_type: (formData.get("lesson_type") as LessonType) ?? "video",
    video_panda_id: (formData.get("video_panda_id") as string) || "",
    duration_seconds: Number(formData.get("duration_seconds") ?? 0),
    is_preview: formData.get("is_preview") === "true",
    position: Number(formData.get("position") ?? 0),
    description: (formData.get("description") as string) || "",
  };
  const parsed = LessonSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data, error } = await supabase
    .from("lessons")
    .insert({ ...parsed.data, module_id: moduleId })
    .select("id")
    .single();

  if (error) return { error: "Erro ao criar aula: " + error.message };

  const file = formData.get("file") as File | null;
  if (file && file.size > 0) await uploadLessonFile(data.id, file);

  const htmlContent = (formData.get("html_content") as string | null)?.trim();
  if (htmlContent) {
    await supabase.from("lesson_content_blocks").insert({
      lesson_id: data.id, type: "html",
      content: JSON.stringify({ html: htmlContent }),
      position: 1,
    });
  }

  revalidatePath(`/admin/cursos/${courseId}`);
  const lesson = await fetchLessonWithMaterials(supabase, data.id);
  return { lesson: lesson ?? undefined };
}

export async function updateLesson(
  lessonId: string,
  courseId: string,
  formData: FormData
): Promise<{ error?: string; lesson?: LessonData }> {
  const supabase = await assertAdmin();
  const raw = {
    title: formData.get("title") as string,
    lesson_type: (formData.get("lesson_type") as LessonType) ?? "video",
    video_panda_id: (formData.get("video_panda_id") as string) || "",
    duration_seconds: Number(formData.get("duration_seconds") ?? 0),
    is_preview: formData.get("is_preview") === "true",
    position: Number(formData.get("position") ?? 0),
    description: (formData.get("description") as string) || "",
  };
  const parsed = LessonSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await supabase.from("lessons").update(parsed.data).eq("id", lessonId);
  if (error) return { error: "Erro ao atualizar aula: " + error.message };

  revalidatePath(`/admin/cursos/${courseId}`);
  const lesson = await fetchLessonWithMaterials(supabase, lessonId);
  return { lesson: lesson ?? undefined };
}

export async function deleteLesson(
  lessonId: string,
  courseId: string
): Promise<{ error?: string }> {
  const supabase = await assertAdmin();
  const { error } = await supabase.from("lessons").delete().eq("id", lessonId);
  if (error) return { error: "Erro ao excluir aula: " + error.message };
  revalidatePath(`/admin/cursos/${courseId}`);
  return {};
}

export async function toggleArchivedLesson(
  lessonId: string,
  courseId: string,
  archived: boolean
): Promise<{ error?: string }> {
  const supabase = await assertAdmin();
  const { error } = await supabase.from("lessons").update({ archived }).eq("id", lessonId);
  if (error) return { error: "Erro ao arquivar aula: " + error.message };
  revalidatePath(`/admin/cursos/${courseId}`);
  return {};
}

// ─── Materiais ────────────────────────────────────────────────────────────────

async function uploadLessonFile(lessonId: string, file: File): Promise<void> {
  if (file.size > 52_428_800) return;
  const ext = file.name.split(".").pop() ?? "bin";
  const filePath = `${lessonId}/${Date.now()}.${ext}`;
  const buffer = new Uint8Array(await file.arrayBuffer());
  const service = createServiceClient();

  const { error: uploadError } = await service.storage
    .from("lesson-materials")
    .upload(filePath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) return;

  const supabase = await createClient();
  await supabase.from("lesson_materials").insert({
    lesson_id: lessonId,
    name: file.name,
    file_path: filePath,
  });
}

export async function uploadMaterialForLesson(
  lessonId: string,
  formData: FormData
): Promise<{ error?: string; material?: LessonMaterial }> {
  const supabase = await assertAdmin();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Arquivo obrigatorio" };
  if (file.size > 52_428_800) return { error: "Arquivo muito grande (max 50MB)" };

  const ext = file.name.split(".").pop() ?? "bin";
  const filePath = `${lessonId}/${Date.now()}.${ext}`;
  const buffer = new Uint8Array(await file.arrayBuffer());
  const service = createServiceClient();

  const { error: uploadError } = await service.storage
    .from("lesson-materials")
    .upload(filePath, buffer, { contentType: file.type, upsert: false });
  if (uploadError) return { error: "Erro no upload: " + uploadError.message };

  const { data, error: dbError } = await supabase
    .from("lesson_materials")
    .insert({ lesson_id: lessonId, name: file.name, file_path: filePath })
    .select("id, name, file_path")
    .single();
  if (dbError) return { error: "Erro ao salvar material: " + dbError.message };

  return { material: data as LessonMaterial };
}

export async function deleteLessonMaterial(
  materialId: string,
  filePath: string,
  courseId: string
): Promise<{ error?: string }> {
  const supabase = await assertAdmin();
  const service = createServiceClient();

  await service.storage.from("lesson-materials").remove([filePath]);

  const { error } = await supabase.from("lesson_materials").delete().eq("id", materialId);
  if (error) return { error: "Erro ao excluir material: " + error.message };
  revalidatePath(`/admin/cursos/${courseId}`);
  return {};
}

export async function refreshLessonWithMaterials(lessonId: string): Promise<LessonData | null> {
  const supabase = await assertAdmin();
  return fetchLessonWithMaterials(supabase, lessonId);
}

// ─── Reordenação ─────────────────────────────────────────────────────────────

export async function reorderModules(
  items: { id: string; position: number }[]
): Promise<void> {
  const supabase = await assertAdmin();
  await Promise.all(
    items.map(({ id, position }) =>
      supabase.from("modules").update({ position }).eq("id", id)
    )
  );
}

export async function reorderLessons(
  items: { id: string; position: number }[]
): Promise<void> {
  const supabase = await assertAdmin();
  await Promise.all(
    items.map(({ id, position }) =>
      supabase.from("lessons").update({ position }).eq("id", id)
    )
  );
}
