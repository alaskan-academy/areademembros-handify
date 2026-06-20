"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";
import { z } from "zod";

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autorizado");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") throw new Error("Não autorizado");
  return { supabase, user };
}

// ─── Blocos ────────────────────────────────────────────────────────────────────

const BlockSchema = z.object({
  type: z.enum(["text", "html", "embed", "download"]),
  content: z.string().min(1, "Conteúdo obrigatório"),
  position: z.number().int().min(0),
});

export async function upsertBlock(
  lessonId: string,
  blockId: string | null,
  data: { type: string; content: string; position: number }
): Promise<void> {
  await assertAdmin();
  const validated = BlockSchema.parse(data);

  const supabase = await createClient();

  if (blockId) {
    const { error } = await supabase
      .from("lesson_content_blocks")
      .update({ ...validated, lesson_id: lessonId })
      .eq("id", blockId);
    if (error) throw new Error("Erro ao atualizar bloco: " + error.message);
  } else {
    const { error } = await supabase
      .from("lesson_content_blocks")
      .insert({ ...validated, lesson_id: lessonId });
    if (error) throw new Error("Erro ao criar bloco: " + error.message);
  }

  revalidatePath(`/aulas/${lessonId}`);
}

export async function deleteBlock(blockId: string): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("lesson_content_blocks")
    .delete()
    .eq("id", blockId);
  if (error) throw new Error("Erro ao deletar bloco: " + error.message);
}

export async function reorderBlocks(
  blocks: { id: string; position: number }[]
): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();

  await Promise.all(
    blocks.map(({ id, position }) =>
      supabase.from("lesson_content_blocks").update({ position }).eq("id", id)
    )
  );
}

// ─── Materiais ─────────────────────────────────────────────────────────────────

const MaterialSchema = z.object({
  name: z.string().min(1).max(200),
  lessonId: z.string().uuid(),
});

export async function uploadMaterial(formData: FormData): Promise<void> {
  await assertAdmin();

  const name = formData.get("name") as string;
  const lessonId = formData.get("lessonId") as string;
  const file = formData.get("file") as File | null;

  MaterialSchema.parse({ name, lessonId });

  if (!file || file.size === 0) throw new Error("Arquivo obrigatório");
  if (file.size > 52_428_800) throw new Error("Arquivo muito grande (máx 50 MB)");

  const ext = file.name.split(".").pop() ?? "bin";
  const filePath = `${lessonId}/${Date.now()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const serviceClient = createServiceClient();
  const { error: uploadError } = await serviceClient.storage
    .from("lesson-materials")
    .upload(filePath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) throw new Error("Erro no upload: " + uploadError.message);

  const supabase = await createClient();
  const { error: insertError } = await supabase.from("lesson_materials").insert({
    lesson_id: lessonId,
    name,
    file_path: filePath,
  });

  if (insertError) {
    // Remove arquivo órfão se o insert falhar
    await serviceClient.storage.from("lesson-materials").remove([filePath]);
    throw new Error("Erro ao salvar material: " + insertError.message);
  }

  revalidatePath(`/aulas/${lessonId}`);
}

export async function deleteMaterial(materialId: string): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();

  const { data: material } = await supabase
    .from("lesson_materials")
    .select("file_path, lesson_id")
    .eq("id", materialId)
    .single();

  if (!material) throw new Error("Material não encontrado");

  const serviceClient = createServiceClient();
  await serviceClient.storage
    .from("lesson-materials")
    .remove([material.file_path]);

  const { error } = await supabase
    .from("lesson_materials")
    .delete()
    .eq("id", materialId);

  if (error) throw new Error("Erro ao deletar material: " + error.message);

  revalidatePath(`/aulas/${material.lesson_id}`);
}
