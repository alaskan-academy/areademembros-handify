"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const ShowcaseSchema = z.object({
  course_id: z.string().uuid(),
  sales_video_panda_id: z.string().trim(),
  position: z.coerce.number().int().min(0),
  active: z.boolean(),
});

export async function upsertShowcaseCourse(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Sem permissão");

  const parsed = ShowcaseSchema.safeParse({
    course_id: formData.get("course_id"),
    sales_video_panda_id: formData.get("sales_video_panda_id") ?? "",
    position: formData.get("position") ?? 0,
    active: formData.get("active") === "true",
  });
  if (!parsed.success) throw new Error("Dados inválidos");

  const { error } = await supabase.from("showcase_courses").upsert(parsed.data, {
    onConflict: "course_id",
  });
  if (error) throw new Error(error.message);

  // Atualiza checkout_url no curso
  const checkoutUrl = (formData.get("checkout_url") as string)?.trim() || null;
  await supabase
    .from("courses")
    .update({ checkout_url: checkoutUrl })
    .eq("id", parsed.data.course_id);

  revalidatePath("/vitrine");
  revalidatePath("/admin/vitrine");
}

export async function reorderShowcaseCourses(items: { course_id: string; position: number }[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Sem permissão");

  await Promise.all(
    items.map(({ course_id, position }) =>
      supabase.from("showcase_courses").update({ position }).eq("course_id", course_id)
    )
  );

  revalidatePath("/vitrine");
  revalidatePath("/admin/vitrine");
}

export async function removeShowcaseCourse(courseId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Sem permissão");

  await supabase.from("showcase_courses").delete().eq("course_id", courseId);

  revalidatePath("/vitrine");
  revalidatePath("/admin/vitrine");
}
