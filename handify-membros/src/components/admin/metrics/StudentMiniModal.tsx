"use client";

import { useState } from "react";
import Link from "next/link";
import { X, UserCircle, Activity } from "lucide-react";
import { useModalBackGuard } from "@/hooks/useModalBackGuard";

export type StudentBasic = {
  id: string;
  name: string | null;
  email: string;
  avatar?: string | null;
  createdAt?: string;
};

export function StudentMiniModal({
  student,
  children,
  className,
}: {
  student: StudentBasic;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const markNavigating = useModalBackGuard(open, () => setOpen(false));

  const displayName = student.name ?? student.email;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(true); }
        }}
        className={className}
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
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-2xl w-[calc(100vw-2rem)] max-w-sm p-6"
            role="dialog"
            aria-modal="true"
            aria-label={`Perfil de ${displayName}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-4 mb-6">
              {student.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={student.avatar}
                  alt=""
                  className="w-14 h-14 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-[#6699F3]/15 flex items-center justify-center text-xl font-bold text-[#6699F3] shrink-0">
                  {initial}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-bold text-base leading-tight truncate">{displayName}</p>
                {student.name && student.email !== student.name && (
                  <p className="text-sm text-muted-foreground truncate mt-0.5">{student.email}</p>
                )}
                {student.createdAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Membro desde {new Date(student.createdAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Link
                href={`/admin/alunos/${student.id}`}
                onClick={markNavigating}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-[#6699F3] text-white rounded-lg hover:bg-[#5580d4] transition-colors"
              >
                <UserCircle className="w-4 h-4" />
                Ver perfil completo
              </Link>
              <Link
                href={`/admin/alunos/${student.id}?tab=atividade`}
                onClick={markNavigating}
                className="flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-[#6699F3] border border-[#6699F3]/30 rounded-lg hover:bg-[#6699F3]/5 transition-colors"
                title="Ver atividade"
                aria-label="Ver atividade"
              >
                <Activity className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  );
}
