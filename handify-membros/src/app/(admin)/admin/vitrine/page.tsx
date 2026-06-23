import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/format";
import VitrineManager from "./vitrine-manager";

export default async function AdminVitrinePage() {
  const supabase = await createClient();

  const [{ data: allCourses }, { data: showcaseRows }] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title, slug, thumbnail_url, price, checkout_url, course_type")
      .eq("published", true)
      .order("title"),
    supabase
      .from("showcase_courses")
      .select("course_id, sales_video_panda_id, position, active")
      .order("position"),
  ]);

  type CourseRow = {
    id: string;
    title: string;
    slug: string;
    thumbnail_url: string | null;
    price: number | null;
    checkout_url: string | null;
    course_type: "course" | "material";
  };

  type ShowcaseRow = {
    course_id: string;
    sales_video_panda_id: string | null;
    position: number;
    active: boolean;
  };

  const showcaseMap = Object.fromEntries(
    ((showcaseRows ?? []) as ShowcaseRow[]).map((r) => [r.course_id, r])
  );

  const courses = ((allCourses ?? []) as CourseRow[]).map((c) => ({
    ...c,
    priceFormatted: formatPrice(c.price ?? 0),
    showcase: showcaseMap[c.id] ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Vitrine</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure quais cursos aparecem na vitrine pública e o vídeo de apresentação de cada um.
        </p>
      </div>
      <VitrineManager courses={courses} />
    </div>
  );
}
