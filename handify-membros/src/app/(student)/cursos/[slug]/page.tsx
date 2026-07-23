import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { notFound } from "next/navigation";
import { formatPrice, formatDuration } from "@/lib/format";
import Link from "next/link";
import Image from "next/image";
import { Lock, Play, CheckCircle, Clock, BookOpen, RotateCcw, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

type ModuleWithLessons = {
  id: string;
  title: string;
  position: number;
  archived: boolean;
  lessons: {
    id: string;
    title: string;
    duration_seconds: number;
    is_preview: boolean;
    position: number;
    archived: boolean;
  }[];
};

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const service = createServiceClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Usa service client para buscar módulos e aulas sem restrição de RLS —
  // a policy de lessons bloqueia não-matriculadas, escondendo a estrutura do curso.
  // Aqui não buscamos video_panda_id, então não há risco de exposição.
  const { data: course } = await service
    .from("courses")
    .select(
      `
      id, slug, title, description, thumbnail_url,
      price, workload_hours, is_subscription_only, product_codes, checkout_url,
      category:categories(name, slug),
      forum:forums(slug),
      modules(
        id, title, position, archived,
        lessons(id, title, duration_seconds, is_preview, position, archived)
      )
    `
    )
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (!course) notFound();

  const modules = ((course.modules as ModuleWithLessons[] | null) ?? [])
    .filter((m) => !m.archived)
    .map((m) => ({ ...m, lessons: (m.lessons ?? []).filter((l) => !l.archived) }));
  modules.sort((a, b) => a.position - b.position);
  modules.forEach((m) => m.lessons.sort((a, b) => a.position - b.position));

  let isEnrolled = false;
  let lastWatchedLessonId: string | null = null;
  let completedCount = 0;
  let progressPct = 0;

  if (user) {
    const now = new Date().toISOString();
    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("id")
      .eq("user_id", user.id)
      .eq("course_id", course.id)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .maybeSingle();
    isEnrolled = !!enrollment;

    if (isEnrolled) {
      const allLessonIds = modules.flatMap((m) =>
        (m.lessons ?? []).map((l) => l.id)
      );
      if (allLessonIds.length) {
        // Uma query: pega todo o progresso ordenado por updated_at (mais recente primeiro)
        const { data: progressRows } = await supabase
          .from("lesson_progress")
          .select("lesson_id, completed, updated_at")
          .eq("user_id", user.id)
          .in("lesson_id", allLessonIds)
          .order("updated_at", { ascending: false });

        const rows = progressRows ?? [];
        // Última aula acessada (primeira da lista já ordenada)
        lastWatchedLessonId = rows[0]?.lesson_id ?? null;
        // Contagem de concluídas
        completedCount = rows.filter((r) => r.completed).length;
        progressPct = Math.round((completedCount / allLessonIds.length) * 100);
      }
    }
  }

  const totalLessons = modules.reduce(
    (acc, m) => acc + (m.lessons?.length ?? 0),
    0
  );
  const totalDuration = modules.reduce(
    (acc, m) =>
      acc +
      (m.lessons?.reduce((a, l) => a + (l.duration_seconds ?? 0), 0) ?? 0),
    0
  );

  const category = course.category as unknown as { name: string; slug: string } | null;
  const forumSlug = (course.forum as unknown as { slug: string } | null)?.slug ?? null;
  const firstLesson = modules[0]?.lessons?.[0];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Hero */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Card de compra — aparece depois no mobile, primeiro na sidebar desktop */}
        <div className="handify-card p-6 space-y-4 self-start order-last lg:order-last lg:sticky lg:top-24">
          {course.thumbnail_url && (
            <div className="aspect-video relative rounded-lg overflow-hidden bg-muted">
              <Image
                src={course.thumbnail_url}
                alt={course.title}
                fill
                unoptimized
                className="object-cover"
              />
            </div>
          )}

          <div className="text-2xl sm:text-3xl font-black">{formatPrice(course.price)}</div>

          {isEnrolled ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[#72CF92] text-sm font-medium">
                <CheckCircle className="w-4 h-4" />
                Você já tem acesso
              </div>

              {/* Barra de progresso — idêntica ao dashboard */}
              {totalLessons > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px] text-muted-foreground">
                    <span>{completedCount}/{totalLessons} aulas</span>
                    <span className={cn("font-semibold", progressPct === 100 ? "text-[#72CF92]" : "text-[#6699F3]")}>
                      {progressPct}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${progressPct}%`,
                        background: progressPct === 100 ? "#72CF92" : "#6699F3",
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Botão — mesma lógica do dashboard */}
              {(lastWatchedLessonId ?? firstLesson?.id) && (
                <Link
                  href={`/aulas/${lastWatchedLessonId ?? firstLesson!.id}`}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors",
                    progressPct === 100
                      ? "bg-[#72CF92]/15 text-[#72CF92] hover:bg-[#72CF92]/25"
                      : lastWatchedLessonId
                      ? "bg-[#6699F3] text-white hover:bg-[#5580d4]"
                      : "bg-muted text-foreground hover:bg-muted/80"
                  )}
                >
                  {progressPct === 100 ? (
                    <><RotateCcw className="w-4 h-4" /> Rever curso</>
                  ) : lastWatchedLessonId ? (
                    <><Play className="w-4 h-4 fill-current" /> Continuar curso</>
                  ) : (
                    <><Play className="w-4 h-4" /> Começar curso</>
                  )}
                </Link>
              )}

              {forumSlug && (
                <Link
                  href={`/comunidade/forum/${forumSlug}`}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium border border-border text-foreground/70 hover:text-[#6699F3] hover:border-[#6699F3]/40 hover:bg-[#6699F3]/5 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  Comunidade do curso
                </Link>
              )}
            </div>
          ) : (
            <>
              <a
                href={(course as unknown as { checkout_url: string | null }).checkout_url ?? `/vitrine`}
                target={(course as unknown as { checkout_url: string | null }).checkout_url ? "_blank" : undefined}
                rel={(course as unknown as { checkout_url: string | null }).checkout_url ? "noopener noreferrer" : undefined}
                className={cn(
                  buttonVariants({ variant: "default" }),
                  "w-full bg-[#6699F3] hover:bg-[#5580d4] text-white font-semibold justify-center"
                )}
              >
                Comprar curso
              </a>
              <p className="text-xs text-muted-foreground text-center">
                Acesso vitalício após a compra
              </p>
            </>
          )}
        </div>

        {/* Info principal — aparece primeiro no mobile */}
        <div className="lg:col-span-2 space-y-4 order-first lg:order-first">
          {category && (
            <span className="text-sm font-medium uppercase tracking-wide text-[#6699F3]">
              {category.name}
            </span>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{course.title}</h1>
          <p className="text-muted-foreground leading-relaxed">{course.description}</p>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4" />
              {totalLessons} aulas
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {formatDuration(totalDuration)} de conteúdo
            </span>
          </div>
        </div>
      </div>

      {/* Conteúdo do curso */}
      <div>
        <h2 className="text-xl font-bold mb-4">Conteúdo do curso</h2>

        {!modules.length ? (
          <div className="handify-card p-8 text-center text-muted-foreground">
            <p>Módulos em breve.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {modules.map((mod, mIdx) => (
              <div key={mod.id} className="handify-card overflow-hidden">
                <div className="px-4 py-3 bg-muted/60 flex items-center justify-between gap-3">
                  <span className="font-semibold text-sm min-w-0 truncate">
                    Módulo {mIdx + 1} — {mod.title}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {mod.lessons?.length ?? 0} aula
                    {mod.lessons?.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="divide-y divide-border/40">
                  {mod.lessons?.map((lesson) => {
                    const canAccess = isEnrolled || lesson.is_preview;
                    return (
                      <div
                        key={lesson.id}
                        className="flex items-center justify-between px-4 py-3 gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {canAccess ? (
                            <Play className="w-4 h-4 text-[#6699F3] shrink-0" />
                          ) : (
                            <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                          )}
                          <div className="min-w-0">
                            {canAccess ? (
                              <Link
                                href={`/aulas/${lesson.id}`}
                                className="text-sm font-medium hover:text-[#6699F3] transition-colors line-clamp-1"
                              >
                                {lesson.title}
                              </Link>
                            ) : (
                              <span className="text-sm text-muted-foreground line-clamp-1">
                                {lesson.title}
                              </span>
                            )}
                            {lesson.is_preview && (
                              <span className="text-xs text-[#72CF92] font-medium">
                                Prévia gratuita
                              </span>
                            )}
                          </div>
                        </div>
                        {lesson.duration_seconds > 0 && (
                          <span className="text-xs text-muted-foreground shrink-0">
                            {formatDuration(lesson.duration_seconds)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
