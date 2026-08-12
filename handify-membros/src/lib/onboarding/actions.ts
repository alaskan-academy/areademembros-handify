"use server";

import { createClient } from "@/lib/supabase/server";

export async function markSectionVisited(sectionId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data } = await supabase
    .from("profiles")
    .select("visited_sections")
    .eq("id", user.id)
    .single();

  const current = (data?.visited_sections as Record<string, boolean>) ?? {};
  if (current[sectionId]) return; // já visitada, evita write desnecessário

  await supabase
    .from("profiles")
    .update({ visited_sections: { ...current, [sectionId]: true } })
    .eq("id", user.id);
}

export async function getVisitedSections(): Promise<Record<string, boolean>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};

  const { data } = await supabase
    .from("profiles")
    .select("visited_sections")
    .eq("id", user.id)
    .single();

  return (data?.visited_sections as Record<string, boolean>) ?? {};
}
