"use client";

import { useState } from "react";
import Link from "next/link";
import { X, CheckCircle2, Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useModalBackGuard } from "@/hooks/useModalBackGuard";

export type CourseMenuModule = {
  id: string;
  title: string;
  position: number;
  lessons: { id: string; title: string; position: number; is_preview: boolean }[];
};

interface Props {
  course: { id: string; slug: string; title: string; thumbnail_url: string | null };
  modules: CourseMenuModule[];
  completedLessonIds: string[];
  lastLessonId: string | null;
  firstLessonId: string | null;
  progress: { completed: number; total: number; percentage: number };
  children: React.ReactNode;
}

export function CourseMenuModal({
  course,
  modules,
  completedLessonIds,
  lastLessonId,
  firstLessonId,
  progress,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const markNavigating = useModalBackGuard(open, () => setOpen(false));

  const completedSet = new Set(completedLessonIds);
  const isComplete = progress.percentage === 100;
  const hasStarted = !!lastLessonId;

  const href = lastLessonId
    ? `/aulas/${lastLessonId}`
    : firstLessonId
    ? `/aulas/${firstLessonId}`
    : `/cursos/${course.slug}`;

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(true); }
        }}
        className="block cursor-pointer"
      >
        {children}
      </span>

      {open && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-2xl w-[calc(100vw-2rem)] max-w-lg flex flex-col"
            style={{ maxHeight: "min(82vh, 620px)" }}
            role="dialog"
            aria-modal="true"
            aria-label={`Conteúdo de ${course.title}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-border flex items-start gap-3 shrink-0">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base line-clamp-2 leading-snug">{course.title}</p>
                {progress.total > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{progress.completed}/{progress.total} aulas</span>
                      <span className={cn("font-semibold", isComplete ? "text-[#72CF92]" : "text-[#6699F3]")}>
                        {progress.percentage}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${progress.percentage}%`,
                          background: isComplete ? "#72CF92" : "#6699F3",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Lista de módulos */}
            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {modules.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum conteúdo disponível.
                </p>
              ) : (
                modules.map((m) => (
                  <div key={m.id} className="handify-card overflow-hidden">
                    <div className="px-3 py-2.5 bg-muted/50 border-b border-border">
                      <p className="text-xs font-semibold text-foreground/80 line-clamp-2">{m.title}</p>
                    </div>
                    <ul className="divide-y divide-border/50">
                      {[...(m.lessons ?? [])].sort((a, b) => a.position - b.position).map((l) => {
                        const done = completedSet.has(l.id);
                        const isNext = !hasStarted && l.id === firstLessonId;
                        return (
                          <li key={l.id}>
                            <Link
                              href={`/aulas/${l.id}`}
                              onClick={markNavigating}
                              className={cn(
                                "flex items-center gap-2.5 px-3 py-2.5 text-xs transition-colors min-h-[44px]",
                                isNext
                                  ? "bg-[#6699F3]/5 hover:bg-[#6699F3]/10"
                                  : "hover:bg-muted/60",
                                done && "text-muted-foreground"
                              )}
                            >
                              {done ? (
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[#72CF92]" />
                              ) : (
                                <span className={cn(
                                  "w-3.5 h-3.5 shrink-0 rounded-full border",
                                  isNext ? "border-[#6699F3]" : "border-muted-foreground/40"
                                )} />
                              )}
                              <span className="line-clamp-2 leading-snug flex-1">{l.title}</span>
                              {l.is_preview && !done && (
                                <span className="text-[10px] text-[#72CF92] shrink-0">(grátis)</span>
                              )}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>

            {/* Footer CTA */}
            <div className="px-5 py-4 border-t border-border shrink-0">
              <Link
                href={href}
                onClick={markNavigating}
                className={cn(
                  "flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-colors min-h-[44px]",
                  isComplete
                    ? "bg-[#72CF92]/15 text-[#72CF92] hover:bg-[#72CF92]/25"
                    : "bg-[#6699F3] text-white hover:bg-[#5580d4]"
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
                    Começar curso
                  </>
                )}
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  );
}
