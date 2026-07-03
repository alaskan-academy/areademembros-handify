import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { getLessonAccess, getMaterialSignedUrl } from "@/app/(student)/aulas/actions";
import PandaPlayer from "@/components/player/PandaPlayer";
import LessonCompleteButton from "@/components/player/LessonCompleteButton";
import ContentBlocks, { type ContentBlock, type LessonMaterial, type VideoPlayerProps } from "@/components/lesson/ContentBlocks";
import Link from "next/link";
import { Lock, ChevronLeft } from "lucide-react";
import NextLessonButton from "@/components/player/NextLessonButton";
import BannerDisplay from "@/components/banner/BannerDisplay";
import { LessonSidebarDesktop } from "@/components/lesson/LessonSidebar";
import { LessonBottomSheet } from "@/components/lesson/LessonBottomSheet";

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
  let hasVideoBlocks = false;

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
    hasVideoBlocks = rawBlocks.some((b) => b.type === "video");
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

  const sidebarProps = {
    courseModules: courseModules as { id: string; title: string; position: number; lessons: { id: string; title: string; position: number; is_preview: boolean }[] }[],
    lessonId: id,
    completedSet,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 overflow-x-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">

        {/* Coluna principal */}
        <div className="space-y-4 min-w-0">
          {/* Breadcrumb */}
          {mod?.course && (
            <nav className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground flex-wrap">
              <Link href="/cursos" className="hover:text-foreground transition-colors shrink-0">
                Cursos
              </Link>
              <span>/</span>
              <Link
                href={`/cursos/${mod.course.slug}`}
                className="hover:text-foreground transition-colors line-clamp-1 max-w-[140px] sm:max-w-[240px]"
              >
                {mod.course.title}
              </Link>
              <span>/</span>
              <span className="text-foreground font-medium line-clamp-1 max-w-[140px] sm:max-w-[240px]">
                {lesson.title}
              </span>
            </nav>
          )}

          <h1 className="text-xl font-bold leading-snug">{lesson.title}</h1>

          {/* Player ou tela de bloqueio */}
          {/* Player legado (video_panda_id na lessons table) — só exibe se não há bloco de vídeo */}
          {videoId && !hasVideoBlocks ? (
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
          <ContentBlocks
            blocks={contentBlocks}
            materials={materials}
            videoPlayerProps={hasAccess ? {
              lessonId: id,
              initialPosition: lastPosition,
              durationSeconds: lesson.duration_seconds ?? 0,
              isCompleted,
            } as VideoPlayerProps : undefined}
          />

          {/* Ações da aula */}
          <div className="flex flex-col gap-3 pt-2">
            {/* Marcar concluída + badge prévia */}
            {(hasAccess && user || lesson.is_preview) && (
              <div className="flex flex-col gap-2">
                {hasAccess && user && (
                  <LessonCompleteButton lessonId={id} isCompleted={isCompleted} />
                )}
                {lesson.is_preview && (
                  <span className="inline-flex items-center gap-2 text-sm text-[#72CF92] font-medium bg-[#72CF92]/10 px-3 py-2 rounded-full self-start">
                    <span className="w-2 h-2 rounded-full bg-[#72CF92]" />
                    Prévia gratuita
                  </span>
                )}
              </div>
            )}

            {/* Anterior / Próxima — grid simétrico, centralizado no mobile */}
            {user && (prevLesson || nextLesson) && (
              <div className="grid grid-cols-2 gap-2 w-full">
                {prevLesson ? (
                  <Link
                    href={`/aulas/${prevLesson.id}`}
                    className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2.5 min-h-[44px] rounded-lg border border-border hover:border-[#6699F3]"
                  >
                    <ChevronLeft className="w-4 h-4 shrink-0" />
                    Anterior
                  </Link>
                ) : <div />}
                {nextLesson ? (
                  <NextLessonButton
                    nextLessonId={nextLesson.id}
                    lessonId={id}
                    isCompleted={isCompleted}
                  />
                ) : <div />}
              </div>
            )}
          </div>

          {/* Bottom sheet — só mobile: Materiais + Menu do curso */}
          <LessonBottomSheet
            materials={materials}
            {...sidebarProps}
          />

          {/* Banner pós-aula */}
          <BannerDisplay slot="pos-aula" />
        </div>

        {/* Coluna lateral: sidebar + banner sticky juntos para não sobreposer um ao outro */}
        <div className="hidden lg:flex flex-col gap-4 self-start sticky top-20">
          <LessonSidebarDesktop {...sidebarProps} />
          <BannerDisplay slot="lateral" />
        </div>
      </div>
    </div>
  );
}
