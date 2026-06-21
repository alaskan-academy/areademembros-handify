import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { MessageSquare, Users, ChevronRight } from "lucide-react";

export const metadata = { title: "Fórum — Handify" };

export default async function ForumLandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Cursos matriculados com info de fórum
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select(`
      course_id,
      courses (
        id, slug, title, thumbnail_url,
        forum_posts(count)
      )
    `)
    .eq("user_id", user.id)
    .or("expires_at.is.null,expires_at.gt.now()");

  type CourseInfo = {
    id: string;
    slug: string;
    title: string;
    thumbnail_url: string | null;
    post_count: number;
  };

  const courses: CourseInfo[] = (enrollments ?? [])
    .map((e) => {
      const c = e.courses as unknown as {
        id: string;
        slug: string;
        title: string;
        thumbnail_url: string | null;
        forum_posts: [{ count: number }];
      } | null;
      if (!c) return null;
      return {
        id: c.id,
        slug: c.slug,
        title: c.title,
        thumbnail_url: c.thumbnail_url ?? null,
        post_count: (c.forum_posts as unknown as [{ count: number }])[0]?.count ?? 0,
      };
    })
    .filter((c): c is CourseInfo => c !== null);

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-[#6699F3]/10 flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-[#6699F3]" />
        </div>
        <div>
          <h1 className="font-black text-xl text-foreground">Fórum da Comunidade</h1>
          <p className="text-sm text-muted-foreground">Discussões por curso</p>
        </div>
      </div>

      {courses.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum curso matriculado</p>
          <p className="text-sm mt-1">Quando você se matricular em um curso, o fórum dele aparece aqui.</p>
          <Link href="/cursos" className="mt-4 inline-block text-sm font-medium text-[#6699F3] hover:underline">
            Ver cursos disponíveis →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {courses.map((course) => (
            <Link
              key={course.id}
              href={`/comunidade/forum/${course.slug}`}
              className="flex items-center gap-4 bg-white rounded-xl border border-border/60 shadow-sm px-4 py-3 hover:border-[#6699F3]/40 hover:shadow-md transition-all group"
            >
              {course.thumbnail_url ? (
                <div className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0">
                  <Image src={course.thumbnail_url} alt={course.title} fill className="object-cover" unoptimized />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-lg bg-[#6699F3]/10 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-6 h-6 text-[#6699F3]" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-sm text-foreground truncate">{course.title}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {course.post_count} {course.post_count === 1 ? "post" : "posts"}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-[#6699F3] transition-colors shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
