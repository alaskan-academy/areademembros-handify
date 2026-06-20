import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { getLessonAccess, getMaterialSignedUrl } from "@/app/(student)/aulas/actions";
import PandaPlayer from "@/components/player/panda-player";
import LessonCompleteButton from "@/components/player/lesson-complete-button";
import ContentBlocks, { type ContentBlock, type LessonMaterial } from "@/components/lesson/content-blocks";
import Link from "next/link";
import { Lock, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import BannerDisplay from "@/components/banner/banner-display";
import { cn } from "@/lib/utils";

type CourseRef = { id: string; title: string; slug: string };
type LessonModule = { id: string; title: string; position: number; course_id: string; course: CourseRef };
type LessonInModule = { id: string; title: string; position: number; is_preview: boolean; archived: boolean };
type ModuleWithLessons = { id: string; title: string; position: number; lessons: LessonInModule[] };

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: lesson }, { data: { user } }] = await Promise.all([
    supabase
      .from("lessons")
      .select(
        "id, title, duration_seconds, is_preview, module_id, module:modules(id, title, position, course_id, course:courses(id, title, slug))"
      )
      .eq("id", id)
      .single(),
    supabase.auth.getUser(),
  ]);

  if (!lesson) notFound();

  const mod = lesson.module as unknown as LessonModule | null;

  // Progresso e conclusão da aula atual
  let lastPosition = 0;
  let isCompleted = false;
  let courseModules: ModuleWithLessons[] = [];
  let completedSet = new Set<string>();

  if (user && mod?.course_id) {
    const [progressResult, modulesResult] = await Promise.all([
      supabase
        .from("lesson_progress")
        .select("last_position, completed")
        .eq("user_id", user.id)
        .eq("lesson_id", id)
        .maybeSingle(),
      supabase
        .from("modules")
        .select("id, title, position, lessons(id, title, position, is_preview, archived)")
        .eq("course_id", mod.course_id)
        .eq("archived", false)
        .order("position"),
    ]);

    lastPosition = progressResult.data?.last_position ?? 0;
    isCompleted = progressResult.data?.completed ?? false;
    courseModules = ((modulesResult.data as ModuleWithLessons[] | null) ?? [])
      .map((m) => ({ ...m, lessons: (m.lessons ?? []).filter((l) => !l.archived) }));

    const allLessonIds = courseModules.flatMap((m) =>
      (m.lessons ?? []).map((l) => l.id)
    );

    if (allLessonIds.length) {
      const { data: allProgress } = await supabase
        .from("lesson_progress")
        .select("lesson_id")
        .eq("user_id", user.id)
        .eq("completed", true)
        .in("lesson_id", allLessonIds);
      completedSet = new Set(allProgress?.map((p) => p.lesson_id) ?? []);
    }
  }

  // Navegação prev/next no contexto do curso
  const allLessonsFlat = courseModules.flatMap((m) =>
    [...(m.lessons ?? [])].sort((a, b) => a.position - b.position)
  );
  const currentIdx = allLessonsFlat.findIndex((l) => l.id === id);
  const prevLesson = currentIdx > 0 ? allLessonsFlat[currentIdx - 1] : null;
  const nextLesson =
    currentIdx >= 0 && currentIdx < allLessonsFlat.length - 1
      ? allLessonsFlat[currentIdx + 1]
      : null;

  const { hasAccess, videoId } = await getLessonAccess(id);

  // Blocos de conteúdo e materiais (só para usuários com acesso)
  let contentBlocks: ContentBlock[] = [];
  let materials: LessonMaterial[] = [];

  if (hasAccess) {
    const [{ data: blocksData }, { data: materialsData }] = await Promise.all([
      supabase
        .from("lesson_content_blocks")
        .select("id, type, content, position")
        .eq("lesson_id", id)
        .order("position"),
      supabase
        .from("lesson_materials")
        .select("id, name")
        .eq("lesson_id", id)
        .order("id"),
    ]);

    const rawBlocks = (blocksData as ContentBlock[] | null) ?? [];
    // Substitui [EMAIL] em URLs de embed pelo email da aluna (server-side)
    contentBlocks = rawBlocks.map((block) => {
      if (block.type !== "embed" || !user?.email) return block;
      try {
        const parsed = JSON.parse(block.content) as Record<string, unknown>;
        if (typeof parsed.url === "string" && parsed.url.includes("[EMAIL]")) {
          return {
            ...block,
            content: JSON.stringify({
              ...parsed,
              url: parsed.url.replace(/\[EMAIL\]/g, encodeURIComponent(user.email)),
            }),
          };
        }
      } catch { /* conteúdo inválido, mantém original */ }
      return block;
    });

    // Gera signed URL para cada material (acesso já verificado via videoId)
    materials = await Promise.all(
      (materialsData ?? []).map(async (m) => ({
        id: m.id,
        name: m.name,
        signed_url: await getMaterialSignedUrl(m.id),
      }))
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">

        {/* Coluna principal */}
        <div className="space-y-4 min-w-0">
          {/* Breadcrumb */}
          {mod?.course && (
            <nav className="flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap">
              <Link href="/cursos" className="hover:text-foreground transition-colors">
                Cursos
              </Link>
              <span>/</span>
              <Link
                href={`/cursos/${mod.course.slug}`}
                className="hover:text-foreground transition-colors truncate max-w-[200px]"
              >
                {mod.course.title}
              </Link>
              <span>/</span>
              <span className="text-foreground font-medium truncate max-w-[200px]">
                {lesson.title}
              </span>
            </nav>
          )}

          <h1 className="text-xl font-bold leading-snug">{lesson.title}</h1>

          {/* Player ou tela de bloqueio */}
          {videoId ? (
            <PandaPlayer
              videoId={videoId}
              lessonId={id}
              initialPosition={lastPosition}
              durationSeconds={lesson.duration_seconds ?? 0}
              isCompleted={isCompleted}
            />
          ) : !hasAccess ? (
            <div className="w-full aspect-video rounded-xl bg-muted flex flex-col items-center justify-center gap-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: "#6699F3" + "20" }}
              >
                <Lock className="w-7 h-7 text-[#6699F3]" />
              </div>
              <div className="text-center space-y-1">
                <p className="font-semibold">Esta aula requer matrícula</p>
                <p className="text-sm text-muted-foreground">
                  Adquira o curso para ter acesso completo.
                </p>
              </div>
              {mod?.course && (
                <Link
                  href={`/cursos/${mod.course.slug}`}
                  className="text-sm text-[#6699F3] hover:underline font-medium"
                >
                  Ver detalhes do curso →
                </Link>
              )}
            </div>
          ) : null}

          {/* Blocos de conteúdo e materiais */}
          <ContentBlocks blocks={contentBlocks} materials={materials} />

          {/* Ações da aula */}
          <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Botão concluir — só para aulas com acesso */}
              {hasAccess && user && (
                <LessonCompleteButton lessonId={id} isCompleted={isCompleted} />
              )}

              {/* Badge prévia gratuita */}
              {lesson.is_preview && (
                <span className="inline-flex items-center gap-2 text-sm text-[#72CF92] font-medium bg-[#72CF92]/10 px-3 py-1.5 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-[#72CF92]" />
                  Prévia gratuita
                </span>
              )}
            </div>

            {/* Navegação prev/next */}
            {user && (prevLesson || nextLesson) && (
              <div className="flex items-center gap-2">
                {prevLesson ? (
                  <Link
                    href={`/aulas/${prevLesson.id}`}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border hover:border-[#6699F3]"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Anterior
                  </Link>
                ) : (
                  <div />
                )}
                {nextLesson && (
                  <Link
                    href={`/aulas/${nextLesson.id}`}
                    className="flex items-center gap-1 text-sm font-medium text-white bg-[#6699F3] hover:bg-[#5580d4] transition-colors px-3 py-1.5 rounded-lg"
                  >
                    Próxima
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Banner pós-aula */}
          <BannerDisplay slot="pos-aula" />
        </div>

        {/* Sidebar — módulos e aulas */}
        {courseModules.length > 0 && (
          <aside className="space-y-3 self-start sticky top-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide px-1">
              Conteúdo do curso
            </h2>
            <div className="space-y-2">
              {courseModules.map((m) => (
                <div key={m.id} className="handify-card overflow-hidden">
                  <div className="px-3 py-2.5 bg-muted/50 border-b border-border">
                    <p className="text-xs font-semibold text-foreground/80 line-clamp-2">
                      {m.title}
                    </p>
                  </div>
                  <ul className="divide-y divide-border/50">
                    {[...(m.lessons ?? [])]
                      .sort((a, b) => a.position - b.position)
                      .map((l) => {
                        const done = completedSet.has(l.id);
                        const isCurrent = l.id === id;
                        return (
                          <li key={l.id}>
                            <Link
                              href={`/aulas/${l.id}`}
                              className={cn(
                                "flex items-center gap-2.5 px-3 py-2 text-xs transition-colors",
                                isCurrent
                                  ? "bg-[#6699F3]/10 text-[#6699F3] font-semibold"
                                  : "hover:bg-muted/60 text-foreground/80"
                              )}
                            >
                              {done ? (
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[#72CF92]" />
                              ) : (
                                <span
                                  className={cn(
                                    "w-3.5 h-3.5 shrink-0 rounded-full border",
                                    isCurrent
                                      ? "border-[#6699F3]"
                                      : "border-muted-foreground/40"
                                  )}
                                />
                              )}
                              <span className="line-clamp-2 leading-snug">
                                {l.title}
                                {l.is_preview && (
                                  <span className="ml-1 text-[10px] text-[#72CF92]">
                                    (grátis)
                                  </span>
                                )}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              ))}
            </div>
            {/* Banner lateral */}
            <BannerDisplay slot="lateral" />
          </aside>
        )}
      </div>
    </div>
  );
}
