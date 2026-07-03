"use client";

import { useState } from "react";
import Link from "next/link";
import { X, FileText, BookOpen, CheckCircle2, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useModalBackGuard } from "@/hooks/useModalBackGuard";

type LessonRef = { id: string; title: string; position: number; is_preview: boolean };
type ModuleItem = { id: string; title: string; position: number; lessons: LessonRef[] };
type MaterialItem = { id: string; name: string; signed_url: string | null };

interface Props {
  materials: MaterialItem[];
  courseModules: ModuleItem[];
  lessonId: string;
  completedSet: Set<string>;
}

export function LessonBottomSheet({ materials, courseModules, lessonId, completedSet }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"materiais" | "menu">("materiais");
  const markNavigating = useModalBackGuard(open, () => setOpen(false));

  const hasMaterials = materials.length > 0;
  const hasModules = courseModules.length > 0;

  if (!hasMaterials && !hasModules) return null;

  function openSheet(t: "materiais" | "menu") {
    setTab(t);
    setOpen(true);
  }

  return (
    <div className="lg:hidden space-y-2">
      {/* Trigger buttons */}
      <div className="flex gap-2">
        {hasMaterials && (
          <button
            onClick={() => openSheet("materiais")}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-border bg-white text-sm font-medium hover:border-[#6699F3] hover:text-[#6699F3] transition-colors min-h-[44px]"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>Materiais</span>
            <span className="ml-0.5 text-xs bg-[#6699F3]/10 text-[#6699F3] rounded-full px-1.5 py-0.5 font-bold">
              {materials.length}
            </span>
          </button>
        )}
        {hasModules && (
          <button
            onClick={() => openSheet("menu")}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-border bg-white text-sm font-medium hover:border-[#6699F3] hover:text-[#6699F3] transition-colors min-h-[44px]"
          >
            <BookOpen className="w-4 h-4 shrink-0" />
            <span>Menu do curso</span>
          </button>
        )}
      </div>

      {/* Bottom sheet overlay */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl flex flex-col"
            style={{ maxHeight: "80vh" }}
            role="dialog"
            aria-modal="true"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>

            {/* Tabs + fechar */}
            <div className="flex items-stretch border-b border-border px-4 gap-1 shrink-0">
              {hasMaterials && (
                <button
                  onClick={() => setTab("materiais")}
                  className={cn(
                    "pb-3 pt-2 px-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                    tab === "materiais"
                      ? "border-[#6699F3] text-[#6699F3]"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  Materiais
                </button>
              )}
              {hasModules && (
                <button
                  onClick={() => setTab("menu")}
                  className={cn(
                    "pb-3 pt-2 px-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                    tab === "menu"
                      ? "border-[#6699F3] text-[#6699F3]"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  Menu do curso
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="ml-auto p-1.5 my-auto rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 p-4">
              {tab === "materiais" && (
                <div className="space-y-2">
                  {materials.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhum material disponível para esta aula.
                    </p>
                  ) : (
                    materials.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center gap-3 p-3 rounded-xl border-2 border-[#6699F3]/25 bg-[#6699F3]/5"
                      >
                        <div className="w-10 h-10 rounded-lg bg-[#6699F3]/15 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5 text-[#6699F3]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-[#6699F3] uppercase tracking-wider mb-0.5">
                            Material da aula
                          </p>
                          <p className="text-sm font-medium truncate">{m.name}</p>
                        </div>
                        {m.signed_url ? (
                          <a
                            href={m.signed_url}
                            download
                            className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-white bg-[#6699F3] hover:bg-[#5580d4] px-3 py-2 rounded-lg min-h-[40px] transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Baixar
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground shrink-0">Indisponível</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {tab === "menu" && (
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
                                onClick={markNavigating}
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
                                <span className="line-clamp-2 leading-snug flex-1">
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
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
