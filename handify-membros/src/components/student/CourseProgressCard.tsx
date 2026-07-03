"use client";

import Link from "next/link";
import { Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { CourseMenuModal, type CourseMenuModule } from "./CourseMenuModal";

export type CourseCardData = {
  course: {
    id: string;
    slug: string;
    title: string;
    thumbnail_url: string | null;
    workload_hours: number;
  };
  progress: { completed: number; total: number; percentage: number };
  lastLessonId: string | null;
  firstLessonId: string | null;
  lastAccess: string | null;
  modules: CourseMenuModule[];
  completedLessonIds: string[];
};

export function CourseProgressCard({ card }: { card: CourseCardData }) {
  const { course, progress, lastLessonId, firstLessonId } = card;
  const isComplete = progress.percentage === 100;
  const hasStarted = !!lastLessonId;

  // Calcula próxima aula (após a última assistida, na ordem)
  const flatLessons = [...card.modules]
    .sort((a, b) => a.position - b.position)
    .flatMap(m => [...m.lessons].sort((a, b) => a.position - b.position));
  const lastIdx = lastLessonId ? flatLessons.findIndex(l => l.id === lastLessonId) : -1;
  const nextLessonId = lastIdx >= 0 && lastIdx < flatLessons.length - 1
    ? flatLessons[lastIdx + 1].id
    : null;

  const href = nextLessonId
    ? `/aulas/${nextLessonId}`
    : lastLessonId
    ? `/aulas/${lastLessonId}`
    : firstLessonId
    ? `/aulas/${firstLessonId}`
    : `/cursos/${course.slug}`;

  return (
    <div className="handify-card overflow-hidden flex flex-col">
      <CourseMenuModal
        course={course}
        modules={card.modules}
        completedLessonIds={card.completedLessonIds}
        lastLessonId={lastLessonId}
        firstLessonId={firstLessonId}
        nextLessonId={nextLessonId}
        progress={progress}
      >
        <div className="aspect-video bg-muted relative overflow-hidden cursor-pointer group/thumb">
          {course.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={course.thumbnail_url}
              alt={course.title}
              className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[#6699F3]/10 text-3xl">
              🎨
            </div>
          )}
          {isComplete && (
            <div className="absolute top-2 right-2 bg-[#72CF92] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              Concluído ✓
            </div>
          )}
        </div>
      </CourseMenuModal>

      <div className="p-4 flex flex-col gap-4 flex-1">
        <Link href={`/cursos/${course.slug}`}>
          <h3 className="font-semibold text-sm line-clamp-2 min-h-[2.5rem] leading-5 hover:text-[#6699F3] transition-colors">
            {course.title}
          </h3>
        </Link>

        {progress.total > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[11px] text-muted-foreground">
              <span>
                {progress.completed}/{progress.total} aulas
              </span>
              <span
                className={cn(
                  "font-semibold",
                  isComplete ? "text-[#72CF92]" : "text-[#6699F3]"
                )}
              >
                {progress.percentage}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progress.percentage}%`,
                  background: isComplete ? "#72CF92" : "#6699F3",
                }}
              />
            </div>
          </div>
        )}

        <Link
          href={href}
          className={cn(
            "mt-auto flex items-center justify-center gap-2 py-2.5 px-3 min-h-[44px] rounded-lg text-sm font-medium transition-colors",
            isComplete
              ? "bg-[#72CF92]/15 text-[#72CF92] hover:bg-[#72CF92]/25"
              : hasStarted
              ? "bg-[#6699F3] text-white hover:bg-[#5580d4]"
              : "bg-muted text-foreground hover:bg-muted/80"
          )}
        >
          {isComplete ? (
            <>
              <RotateCcw className="w-3.5 h-3.5" />
              Rever curso
            </>
          ) : hasStarted ? (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              Continuar
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              Começar
            </>
          )}
        </Link>
      </div>
    </div>
  );
}
