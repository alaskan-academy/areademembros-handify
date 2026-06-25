import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import AdminBlocksEditor from "./blocks-editor";
import AdminMaterialsUploader from "./materials-uploader";

export default async function AdminLessonPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const [{ data: lesson }, { data: course }, { data: blocksData }, { data: materialsData }] =
    await Promise.all([
      supabase
        .from("lessons")
        .select("id, title, is_preview, duration_seconds")
        .eq("id", lessonId)
        .single(),
      supabase
        .from("courses")
        .select("id, title")
        .eq("id", courseId)
        .single(),
      supabase
        .from("lesson_content_blocks")
        .select("id, type, content, position")
        .eq("lesson_id", lessonId)
        .order("position"),
      supabase
        .from("lesson_materials")
        .select("id, name, file_path")
        .eq("lesson_id", lessonId)
        .order("id"),
    ]);

  if (!lesson || !course) notFound();

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap">
        <Link href="/admin/cursos" className="hover:text-foreground transition-colors">
          Cursos
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link
          href={`/admin/cursos/${courseId}`}
          className="hover:text-foreground transition-colors"
        >
          {course.title}
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-foreground font-medium">{lesson.title}</span>
      </nav>

      <div>
        <h1 className="text-2xl font-bold">{lesson.title}</h1>
        <div className="flex items-center gap-3 mt-1.5">
          {lesson.is_preview && (
            <span className="text-xs text-[#72CF92] bg-[#72CF92]/10 px-2 py-0.5 rounded-full font-medium">
              Prévia gratuita
            </span>
          )}
          {lesson.duration_seconds && (
            <span className="text-xs text-muted-foreground">
              {Math.floor(lesson.duration_seconds / 60)}min
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
        <AdminBlocksEditor
          lessonId={lessonId}
          initialBlocks={
            (blocksData as Array<{
              id: string;
              type: "text" | "html" | "embed" | "download" | "video";
              content: string;
              position: number;
            }> | null) ?? []
          }
        />
        <AdminMaterialsUploader
          lessonId={lessonId}
          initialMaterials={
            (materialsData as Array<{
              id: string;
              name: string;
              file_path: string;
            }> | null) ?? []
          }
        />
      </div>
    </div>
  );
}
