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
  duration_seconds: z.number().int().min(0).default(0),
  is_preview: z.boolean().default(false),
  position: z.number().int().min(0),
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
    duration_seconds: Number(formData.get("duration_seconds") ?? 0) * 60,
    is_preview: formData.get("is_preview") === "true",
    position: Number(formData.get("position") ?? 0),
  };
  const parsed = LessonSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data, error } = await supabase
    .from("lessons")
    .insert({ ...parsed.data, module_id: moduleId, lesson_type: "mixed" })
    .select("id")
    .single();

  if (error) return { error: "Erro ao criar aula: " + error.message };

  // Atalho de vídeo: cria o bloco de vídeo automaticamente se ID foi informado
  const videoId = (formData.get("video_panda_id") as string)?.trim();
  if (videoId) {
    await supabase.from("lesson_content_blocks").insert({
      lesson_id: data.id,
      type: "video",
      content: JSON.stringify({ video_panda_id: videoId }),
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
    duration_seconds: Number(formData.get("duration_seconds") ?? 0) * 60,
    is_preview: formData.get("is_preview") === "true",
    position: Number(formData.get("position") ?? 0),
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

export async function createUploadUrlForLesson(
  lessonId: string,
  filename: string,
): Promise<{ signedUrl: string; filePath: string } | { error: string }> {
  try {
    await assertAdmin();
    const ext = filename.split(".").pop()?.toLowerCase() ?? "bin";
    const filePath = `${lessonId}/${Date.now()}.${ext}`;
    const service = createServiceClient();
    const { data, error } = await service.storage
      .from("lesson-materials")
      .createSignedUploadUrl(filePath);
    if (error) return { error: "Erro ao gerar URL de upload: " + error.message };
    return { signedUrl: data.signedUrl, filePath };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro" };
  }
}

export async function saveMaterialMetadataForLesson(
  lessonId: string,
  name: string,
  filePath: string,
): Promise<{ error?: string; material?: LessonMaterial }> {
  const supabase = await assertAdmin();
  const { data, error } = await supabase
    .from("lesson_materials")
    .insert({ lesson_id: lessonId, name, file_path: filePath })
    .select("id, name, file_path")
    .single();
  if (error) return { error: "Erro ao salvar material: " + error.message };
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
