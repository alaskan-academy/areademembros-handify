import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CourseManager from "./course-manager";

export default async function AdminCoursesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const [{ data: courses }, { data: categories }, { data: forums }] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title, slug, description, price, product_codes, workload_hours, course_type, is_subscription_only, has_certificate, published, category_id, forum_id, thumbnail_url, category:categories(name), forum:forums(title, slug)")
      .order("created_at", { ascending: false }),
    supabase.from("categories").select("id, name").order("name"),
    supabase.from("forums").select("id, title, slug").order("title"),
  ]);

  type CourseRow = {
    id: string; title: string; slug: string; description: string | null;
    price: number | null; product_codes: string[]; workload_hours: number | null;
    course_type: "course" | "material"; is_subscription_only: boolean;
    has_certificate: boolean; published: boolean;
    category_id: string | null; forum_id: string | null; thumbnail_url: string | null;
    category: { name: string } | null;
    forum: { title: string; slug: string } | null;
  };

  return (
    <CourseManager
      courses={(courses as unknown as CourseRow[] | null) ?? []}
      categories={(categories as { id: string; name: string }[] | null) ?? []}
      forums={(forums as { id: string; title: string; slug: string }[] | null) ?? []}
    />
  );
}
