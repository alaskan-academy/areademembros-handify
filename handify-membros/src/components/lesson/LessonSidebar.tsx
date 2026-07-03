"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

type LessonItem = { id: string; title: string; position: number; is_preview: boolean };
type ModuleItem = { id: string; title: string; position: number; lessons: LessonItem[] };

interface Props {
  courseModules: ModuleItem[];
  lessonId: string;
  completedSet: Set<string>;
}

function ModuleList({ courseModules, lessonId, completedSet }: Props) {
  return (
    <div className="space-y-2">
      {courseModules.map((m) => (
        <div key={m.id} className="handify-card overflow-hidden">
          <div className="px-3 py-2.5 bg-muted/50 border-b border-border">
            <p className="text-xs font-semibold text-foreground/80 line-clamp-2">{m.title}</p>
          </div>
          <ul className="divide-y divide-border/50">
            {[...(m.lessons ?? [])].sort((a, b) => a.position - b.position).map((l) => {
              const done = completedSet.has(l.id);
              const isCurrent = l.id === lessonId;
              return (
                <li key={l.id}>
                  <Link
                    href={`/aulas/${l.id}`}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2.5 text-xs transition-colors min-h-[44px]",
                      isCurrent
                        ? "bg-[#6699F3]/10 text-[#6699F3] font-semibold"
                        : "hover:bg-muted/60 text-foreground/80"
                    )}
                  >
                    {done ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[#72CF92]" />
                    ) : (
                      <span className={cn(
                        "w-3.5 h-3.5 shrink-0 rounded-full border",
                        isCurrent ? "border-[#6699F3]" : "border-muted-foreground/40"
                      )} />
                    )}
                    <span className="line-clamp-2 leading-snug">
                      {l.title}
                      {l.is_preview && (
                        <span className="ml-1 text-[10px] text-[#72CF92]">(grátis)</span>
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
  );
}

// Versão mobile: aparece abaixo do player, colapsável
export function LessonSidebarMobile({ courseModules, lessonId, completedSet }: Props) {
  const [open, setOpen] = useState(false);
  if (!courseModules.length) return null;
  return (
    <div className="lg:hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-border shadow-sm text-sm font-semibold"
        aria-expanded={open}
      >
        <span>Conteúdo do curso</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="mt-2">
          <ModuleList courseModules={courseModules} lessonId={lessonId} completedSet={completedSet} />
        </div>
      )}
    </div>
  );
}

// Versão desktop: sidebar sticky
export function LessonSidebarDesktop({ courseModules, lessonId, completedSet }: Props) {
  if (!courseModules.length) return null;
  return (
    <aside className="hidden lg:block space-y-3 sticky top-20">
      <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide px-1">
        Conteúdo do curso
      </h2>
      <ModuleList courseModules={courseModules} lessonId={lessonId} completedSet={completedSet} />
    </aside>
  );
}
