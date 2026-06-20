"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { z } from "zod";

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data: p } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (p?.role !== "admin") throw new Error("Sem permissão");
}

const VALID_ICONS = [
  "LayoutDashboard", "BookOpen", "User", "Bell", "Users", "Home",
  "ShoppingBag", "Star", "Heart", "Globe", "MessageSquare", "Video",
  "Award", "Settings", "HelpCircle", "GraduationCap", "Layers",
  "Zap", "Gift", "Map",
] as const;

const menuItemSchema = z.object({
  label: z.string().min(1, "Label obrigatório").max(60),
  url: z.string().min(1, "URL obrigatória").max(255),
  icon: z.enum(VALID_ICONS).optional().nullable(),
  target: z.enum(["_self", "_blank"]).default("_self"),
  visible_to: z.enum(["guest", "student", "admin"]),
  position: z.coerce.number().int().min(0),
  parent_id: z.string().uuid().nullable().optional(),
  active: z.boolean().default(true),
});

export type MenuItemFormState = {
  error?: string;
  success?: boolean;
};

export async function createMenuItemAction(
  _prev: MenuItemFormState,
  formData: FormData
): Promise<MenuItemFormState> {
  try {
    await assertAdmin();
    const service = createServiceClient();

    const parsed = menuItemSchema.safeParse({
      label: formData.get("label"),
      url: formData.get("url"),
      icon: formData.get("icon") || null,
      target: formData.get("target") || "_self",
      visible_to: formData.get("visible_to"),
      position: formData.get("position"),
      parent_id: formData.get("parent_id") || null,
      active: formData.get("active") === "true",
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0].message };
    }

    const { error } = await service.from("menu_items").insert(parsed.data);
    if (error) return { error: error.message };

    revalidatePath("/admin/menu");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

export async function updateMenuItemAction(
  _prev: MenuItemFormState,
  formData: FormData
): Promise<MenuItemFormState> {
  try {
    await assertAdmin();
    const service = createServiceClient();

    const id = formData.get("id") as string;
    if (!id) return { error: "ID obrigatório" };

    const parsed = menuItemSchema.safeParse({
      label: formData.get("label"),
      url: formData.get("url"),
      icon: formData.get("icon") || null,
      target: formData.get("target") || "_self",
      visible_to: formData.get("visible_to"),
      position: formData.get("position"),
      parent_id: formData.get("parent_id") || null,
      active: formData.get("active") === "true",
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0].message };
    }

    const { error } = await service
      .from("menu_items")
      .update(parsed.data)
      .eq("id", id);
    if (error) return { error: error.message };

    revalidatePath("/admin/menu");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

export async function deleteMenuItemAction(id: string): Promise<MenuItemFormState> {
  try {
    await assertAdmin();
    const service = createServiceClient();

    const { error } = await service.from("menu_items").delete().eq("id", id);
    if (error) return { error: error.message };

    revalidatePath("/admin/menu");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

export async function toggleMenuItemActiveAction(
  id: string,
  active: boolean
): Promise<MenuItemFormState> {
  try {
    await assertAdmin();
    const service = createServiceClient();

    const { error } = await service
      .from("menu_items")
      .update({ active })
      .eq("id", id);
    if (error) return { error: error.message };

    revalidatePath("/admin/menu");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

export const ICON_OPTIONS = VALID_ICONS;
