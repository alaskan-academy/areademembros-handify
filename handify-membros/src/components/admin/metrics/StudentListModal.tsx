"use client";

import { useState } from "react";
import Link from "next/link";
import { X, Users, ChevronRight } from "lucide-react";
import { useModalBackGuard } from "@/hooks/useModalBackGuard";
import { StudentMiniModal, type StudentBasic } from "./StudentMiniModal";

export function StudentListModal({
  title,
  subtitle,
  students,
  children,
}: {
  title: string;
  subtitle?: string;
  students: StudentBasic[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const markNavigating = useModalBackGuard(open, () => setOpen(false));

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(true); }
        }}
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
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-2xl w-[calc(100vw-2rem)] max-w-md flex flex-col"
            style={{ maxHeight: "min(72vh, 560px)" }}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-border flex items-center gap-3 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-[#6699F3]/10 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-[#6699F3]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{title}</p>
                {subtitle && (
                  <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
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

            {/* List */}
            <div className="overflow-y-auto flex-1">
              {students.length === 0 ? (
                <div className="py-16 text-center">
                  <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Nenhuma aluna neste grupo</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {students.map((s) => {
                    const name = s.name ?? s.email;
                    const initial = name.charAt(0).toUpperCase();
                    return (
                      <StudentMiniModal key={s.id} student={s}>
                        <div className="px-5 py-3 flex items-center gap-3 hover:bg-muted/40 transition-colors cursor-pointer">
                          {s.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={s.avatar}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[#6699F3]/15 flex items-center justify-center text-sm font-bold text-[#6699F3] shrink-0">
                              {initial}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{name}</p>
                            <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0" />
                        </div>
                      </StudentMiniModal>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {students.length > 0 && (
              <div className="px-5 py-3 border-t border-border flex items-center justify-between shrink-0">
                <span className="text-xs text-muted-foreground">
                  {students.length} aluna{students.length !== 1 ? "s" : ""}
                </span>
                <Link
                  href="/admin/alunos"
                  className="text-xs font-medium text-[#6699F3] hover:underline flex items-center gap-1"
                  onClick={markNavigating}
                >
                  Ver todas em Alunas <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
