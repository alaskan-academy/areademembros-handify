"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { getViewer } from "@/lib/auth/access";

/**
 * Edição das ferramentas pelo painel: tier mínimo, categorias que liberam,
 * grupo, ordem, "em breve", ativa. Sem deploy — o mesmo princípio backend-first
 * do menu. Ver .claude/plans/tiers-handify.md (fase 3).
 */

export type ToolActionState = { error?: string; success?: string };

const schema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2, "Informe o nome"),
  description: z.string().trim().max(200, "Descrição longa demais (máx. 200)").optional().or(z.literal("")),
  icon: z.string().trim().max(8).optional().or(z.literal("")),
  section: z.enum(["calcular", "guardar", "fornecedores"]),
  min_tier: z.enum(["visitante", "aluna", "completo"]),
  href: z.string().trim().optional().or(z.literal("")),
  coming_soon: z.boolean(),
  active: z.boolean(),
  position: z.coerce.number().int().min(0).max(999),
  category_ids: z.array(z.string().uuid()),
});

export async function updateToolAction(
  _prev: ToolActionState,
  formData: FormData
): Promise<ToolActionState> {
  const { userId, isAdmin } = await getViewer();
  if (!userId || !isAdmin) return { error: "Sem permissão." };

  const parsed = schema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    icon: formData.get("icon") ?? "",
    section: formData.get("section"),
    min_tier: formData.get("min_tier"),
    href: formData.get("href") ?? "",
    coming_soon: formData.get("coming_soon") === "on",
    active: formData.get("active") === "on",
    position: formData.get("position") ?? 0,
    category_ids: formData.getAll("category_ids").map(String),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, category_ids, ...campos } = parsed.data;

  const service = createServiceClient();
  const { data: antes } = await service
    .from("tools")
    .select("slug, min_tier, section, coming_soon, active")
    .eq("id", id)
    .maybeSingle();
  if (!antes) return { error: "Ferramenta não encontrada." };

  const { error } = await service
    .from("tools")
    .update({
      name: campos.name,
      description: campos.description || null,
      icon: campos.icon || null,
      section: campos.section,
      min_tier: campos.min_tier,
      href: campos.href || null,
      coming_soon: campos.coming_soon,
      active: campos.active,
      position: campos.position,
    })
    .eq("id", id);
  if (error) return { error: `Erro ao salvar: ${error.message}` };

  // Categorias: troca o conjunto inteiro — é o que o formulário mostra.
  await service.from("tool_categories").delete().eq("tool_id", id);
  if (category_ids.length) {
    const { error: catErr } = await service
      .from("tool_categories")
      .insert(category_ids.map((category_id) => ({ tool_id: id, category_id })));
    if (catErr) return { error: `Ferramenta salva, mas as categorias falharam: ${catErr.message}` };
  }

  await service.from("audit_log").insert({
    admin_id: userId,
    action: "tool.updated",
    target_type: "tool",
    target_id: id,
    meta: { slug: antes.slug, antes, depois: { ...campos, category_ids } },
  });

  revalidatePath("/admin/ferramentas");
  revalidatePath("/ferramentas");
  return { success: "Salvo." };
}
