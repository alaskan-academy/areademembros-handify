import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import CourseContentManager from "./course-content-manager";
import type { LessonData } from "./actions";

export default async function AdminCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const { data: course } = await supabase
    .from("courses")
    .select("id, title, slug")
    .eq("id", courseId)
    .single();

  if (!course) notFound();

  const { data: modules } = await supabase
    .from("modules")
    .select(`
      id, title, position, archived,
      lessons(
        id, title, position, is_preview, archived,
        duration_seconds, video_panda_id, lesson_type, description,
        lesson_materials(id, name, file_path)
      )
    `)
    .eq("course_id", courseId)
    .order("position");

  type ModuleRow = {
    id: string; title: string; position: number; archived: boolean;
    lessons: (Omit<LessonData, "materials"> & { lesson_materials: { id: string; name: string; file_path: string }[] })[];
  };

  const normalizedModules = ((modules as ModuleRow[] | null) ?? []).map((mod) => ({
    ...mod,
    lessons: mod.lessons.map(({ lesson_materials, ...lesson }) => ({
      ...lesson,
      lesson_type: lesson.lesson_type as LessonData["lesson_type"],
      materials: lesson_materials ?? [],
    })),
  }));

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/admin/cursos" className="hover:text-foreground transition-colors">Cursos</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-foreground font-medium">{course.title}</span>
      </nav>

      <div>
        <h1 className="text-2xl font-bold">{course.title}</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Slug: <span className="font-mono">{course.slug}</span>
          <span className="mx-2">·</span>
          <a href={`/cursos/${course.slug}`} target="_blank" rel="noopener noreferrer"
            className="text-[#6699F3] hover:underline">
            Ver página pública →
          </a>
        </p>
      </div>

      <CourseContentManager courseId={courseId} initialModules={normalizedModules} />
    </div>
  );
}
