import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { MessageSquare, Users, ChevronRight } from "lucide-react";

export const metadata = { title: "Comunidade — Handify" };

export default async function ForumLandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Busca os forum_ids vinculados a cursos em que a aluna está matriculada.
  // Não depende de RLS — garante o filtro mesmo que as policies estejam incompletas.
  const { data: enrolledCourses } = await supabase
    .from("enrollments")
    .select("course_id")
    .eq("user_id", user.id)
    .or("expires_at.is.null,expires_at.gt.now()");

  const courseIds = (enrolledCourses ?? []).map((e) => e.course_id);

  let forumIds: string[] = [];
  if (courseIds.length > 0) {
    const { data: linkedCourses } = await supabase
      .from("courses")
      .select("forum_id")
      .in("id", courseIds)
      .not("forum_id", "is", null);

    forumIds = [
      ...new Set(
        (linkedCourses ?? [])
          .map((c) => c.forum_id as string | null)
          .filter((id): id is string => id !== null)
      ),
    ];
  }

  const [{ data: forums }, { data: postCountsRaw }] = await Promise.all([
    forumIds.length > 0
      ? supabase
          .from("forums")
          .select("id, title, slug, description")
          .in("id", forumIds)
          .eq("archived", false)
          .order("title")
      : Promise.resolve({ data: [] as { id: string; title: string; slug: string; description: string | null }[] }),
    supabase
      .from("forum_posts")
      .select("forum_id")
      .eq("approved", true)
      .not("forum_id", "is", null),
  ]);

  const postCounts: Record<string, number> = {};
  for (const p of postCountsRaw ?? []) {
    if (p.forum_id) postCounts[p.forum_id] = (postCounts[p.forum_id] ?? 0) + 1;
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      {/* Hero */}
      <div className="bg-white border-b border-border/60">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 text-center">
          <p className="text-sm font-medium text-[#6699F3] uppercase tracking-wide mb-3">
            Comunidade
          </p>
          <h1 className="text-3xl sm:text-4xl font-black text-[#0F0F0F]">
            <span className="text-[#6699F3]">Comunidade</span>
          </h1>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            Tire dúvidas, compartilhe projetos e troque experiências com outras artesãs.
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {(forums ?? []).length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum fórum disponível</p>
          <p className="text-sm mt-1">Os fóruns ficam disponíveis assim que você se matricula em um curso que possui fórum.</p>
          <Link href="/cursos" className="mt-4 inline-block text-sm font-medium text-[#6699F3] hover:underline">
            Ver cursos disponíveis →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {(forums ?? []).map((forum) => (
            <Link
              key={forum.id}
              href={`/comunidade/forum/${forum.slug}`}
              className="flex items-center gap-4 bg-white rounded-xl border border-border/60 shadow-sm px-4 py-3.5 hover:border-[#6699F3]/40 hover:shadow-md transition-all group"
            >
              <div className="w-11 h-11 rounded-xl bg-[#6699F3]/10 flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5 text-[#6699F3]" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-sm text-foreground">{forum.title}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {forum.description
                    ? <span className="line-clamp-1">{forum.description}</span>
                    : <span>{postCounts[forum.id] ?? 0} {(postCounts[forum.id] ?? 0) === 1 ? "post" : "posts"}</span>
                  }
                </p>
              </div>
              <div className="text-right shrink-0">
                {forum.description && (
                  <p className="text-xs text-muted-foreground mb-1">{postCounts[forum.id] ?? 0} posts</p>
                )}
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-[#6699F3] transition-colors ml-auto" />
              </div>
            </Link>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
