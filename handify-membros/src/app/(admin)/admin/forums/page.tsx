import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ForumsAdminClient from "./ForumsAdminClient";

export const metadata = { title: "Fóruns — Admin Handify" };

export default async function AdminForumsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const [{ data: forums }, { data: courseCountsRaw }] = await Promise.all([
    supabase.from("forums").select("id, title, slug, description").order("title"),
    supabase.from("courses").select("forum_id").not("forum_id", "is", null),
  ]);

  const courseCounts: Record<string, number> = {};
  for (const c of courseCountsRaw ?? []) {
    if (c.forum_id) courseCounts[c.forum_id] = (courseCounts[c.forum_id] ?? 0) + 1;
  }

  return (
    <ForumsAdminClient
      forums={(forums ?? []).map((f) => ({ ...f, course_count: courseCounts[f.id] ?? 0 }))}
    />
  );
}
