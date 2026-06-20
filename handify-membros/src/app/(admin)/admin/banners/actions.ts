"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { z } from "zod";

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (p?.role !== "admin") throw new Error("Sem permissão");
}

const bannerSchema = z.object({
  title: z.string().min(1, "Título obrigatório"),
  link_url: z.string().url("URL de destino inválida"),
  position_slot: z.enum(["header", "lateral", "pos-aula"]),
  starts_at: z.string().optional(),
  ends_at: z.string().optional(),
  active: z.boolean(),
});

function toIso(dateStr: string | undefined): string | null {
  if (!dateStr) return null;
  return new Date(dateStr).toISOString();
}

async function uploadBannerImage(
  file: File,
  service: ReturnType<typeof createServiceClient>
): Promise<{ url: string } | { error: string }> {
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await service.storage
    .from("banners")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) return { error: `Erro ao enviar imagem: ${uploadError.message}` };

  const { data: { publicUrl } } = service.storage.from("banners").getPublicUrl(path);
  return { url: publicUrl };
}

async function resolveImageUrl(
  formData: FormData,
  service: ReturnType<typeof createServiceClient>
): Promise<{ imageUrl: string } | { error: string }> {
  const file = formData.get("image_file") as File | null;
  const existing = (formData.get("existing_image_url") as string | null) ?? "";

  if (file && file.size > 0) {
    const result = await uploadBannerImage(file, service);
    if ("error" in result) return result;
    return { imageUrl: result.url };
  }

  if (existing) return { imageUrl: existing };
  return { error: "Selecione uma imagem para o banner." };
}

// ─── Criar ────────────────────────────────────────────────────────────────────

export async function createBannerAction(
  _prev: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  try { await assertAdmin(); } catch (e) { return { error: (e as Error).message }; }

  const service = createServiceClient();
  const productCodes = formData.getAll("product_codes").map(String).filter(Boolean);

  const parsed = bannerSchema.safeParse({
    title: formData.get("title"),
    link_url: formData.get("link_url"),
    position_slot: formData.get("position_slot"),
    starts_at: formData.get("starts_at") || undefined,
    ends_at: formData.get("ends_at") || undefined,
    active: formData.get("active") === "true",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const imageResult = await resolveImageUrl(formData, service);
  if ("error" in imageResult) return imageResult;

  const { error } = await service.from("banners").insert({
    ...parsed.data,
    image_url: imageResult.imageUrl,
    product_codes: productCodes,
    starts_at: toIso(parsed.data.starts_at),
    ends_at: toIso(parsed.data.ends_at),
  });

  if (error) return { error: `Erro ao criar banner: ${error.message}` };

  revalidatePath("/admin/banners");
  redirect("/admin/banners");
}

// ─── Atualizar ────────────────────────────────────────────────────────────────

export async function updateBannerAction(
  bannerId: string,
  _prev: { error?: string; success?: string },
  formData: FormData
): Promise<{ error?: string; success?: string }> {
  try { await assertAdmin(); } catch (e) { return { error: (e as Error).message }; }

  const service = createServiceClient();
  const productCodes = formData.getAll("product_codes").map(String).filter(Boolean);

  const parsed = bannerSchema.safeParse({
    title: formData.get("title"),
    link_url: formData.get("link_url"),
    position_slot: formData.get("position_slot"),
    starts_at: formData.get("starts_at") || undefined,
    ends_at: formData.get("ends_at") || undefined,
    active: formData.get("active") === "true",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const imageResult = await resolveImageUrl(formData, service);
  if ("error" in imageResult) return imageResult;

  const { error } = await service
    .from("banners")
    .update({
      ...parsed.data,
      image_url: imageResult.imageUrl,
      product_codes: productCodes,
      starts_at: toIso(parsed.data.starts_at),
      ends_at: toIso(parsed.data.ends_at),
    })
    .eq("id", bannerId);

  if (error) return { error: `Erro ao salvar: ${error.message}` };

  revalidatePath("/admin/banners");
  return { success: "Banner atualizado." };
}

// ─── Excluir ──────────────────────────────────────────────────────────────────

export async function deleteBannerAction(bannerId: string, _formData: FormData): Promise<void> {
  await assertAdmin();

  const supabase = await createClient();

  // Busca a URL da imagem para limpar o Storage
  const { data: banner } = await supabase
    .from("banners")
    .select("image_url")
    .eq("id", bannerId)
    .single();

  const service = createServiceClient();

  // Remove o arquivo do Storage se for do bucket de banners
  if (banner?.image_url) {
    try {
      const url = new URL(banner.image_url);
      const segments = url.pathname.split("/");
      const bucketIdx = segments.indexOf("banners");
      if (bucketIdx !== -1) {
        const filePath = segments.slice(bucketIdx + 1).join("/");
        await service.storage.from("banners").remove([filePath]);
      }
    } catch {
      // falha silenciosa — o registro é deletado de qualquer forma
    }
  }

  const { error } = await service.from("banners").delete().eq("id", bannerId);
  if (error) throw new Error("Erro ao excluir banner.");

  revalidatePath("/admin/banners");
  redirect("/admin/banners");
}

// ─── Toggle ativo ─────────────────────────────────────────────────────────────

export async function toggleBannerActiveAction(
  bannerId: string,
  active: boolean,
  _formData: FormData
): Promise<void> {
  await assertAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("banners").update({ active }).eq("id", bannerId);
  if (error) throw new Error("Erro ao atualizar banner.");

  revalidatePath("/admin/banners");
}
