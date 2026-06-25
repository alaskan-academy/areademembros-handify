"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (p?.role !== "admin") redirect("/dashboard");
}

const PageSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  content: z.string(),
  published: z.boolean(),
});

export async function savePage(id: string | null, formData: FormData) {
  await assertAdmin();
  const service = createServiceClient();

  const raw = {
    title: String(formData.get("title") ?? "").trim(),
    slug: String(formData.get("slug") ?? "").trim(),
    content: String(formData.get("content") ?? ""),
    published: formData.get("published") === "true",
  };

  const parsed = PageSchema.safeParse(raw);
  if (!parsed.success) return { error: "Dados inválidos: " + parsed.error.issues[0].message };

  const { title, slug, content, published } = parsed.data;
  const blocks = [{ type: "html", content, position: 0 }];

  if (id) {
    const { error } = await service
      .from("static_pages")
      .update({ title, slug, blocks, published })
      .eq("id", id);
    if (error) return { error: error.message };
  } else {
    const { error } = await service
      .from("static_pages")
      .insert({ title, slug, blocks, published });
    if (error) {
      if (error.code === "23505") return { error: "Já existe uma página com este slug." };
      return { error: error.message };
    }
  }

  revalidatePath("/admin/paginas");
  revalidatePath(`/p/${slug}`);
  return { error: null };
}

export async function deletePage(id: string) {
  await assertAdmin();
  const service = createServiceClient();
  const { error } = await service.from("static_pages").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/paginas");
  return { error: null };
}

export async function togglePublished(id: string, published: boolean) {
  await assertAdmin();
  const service = createServiceClient();
  const { error } = await service.from("static_pages").update({ published }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/paginas");
  return { error: null };
}
