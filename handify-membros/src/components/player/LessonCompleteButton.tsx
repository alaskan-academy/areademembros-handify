"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Loader2, AlertCircle, XCircle } from "lucide-react";
import { markLessonComplete, unmarkLessonComplete } from "@/app/(student)/aulas/actions";
import { cn } from "@/lib/utils";

interface LessonCompleteButtonProps {
  lessonId: string;
  isCompleted: boolean;
}

export default function LessonCompleteButton({
  lessonId,
  isCompleted,
}: LessonCompleteButtonProps) {
  const [optimisticCompleted, setOptimisticCompleted] = useState(isCompleted);
  const [error, setError] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleClick = () => {
    if (isPending) return;
    setError(false);

    if (optimisticCompleted) {
      // Desmarcar
      setOptimisticCompleted(false);
      startTransition(async () => {
        try {
          await unmarkLessonComplete(lessonId);
          router.refresh();
        } catch {
          setOptimisticCompleted(true);
          setError(true);
        }
      });
    } else {
      // Marcar como concluída
      setOptimisticCompleted(true);
      startTransition(async () => {
        try {
          const result = await markLessonComplete(lessonId);
          router.refresh();
          if (result.certificateIssued) {
            router.push("/perfil?certificado=1");
          }
        } catch {
          setOptimisticCompleted(false);
          setError(true);
        }
      });
    }
  };

  const showUnmarkState = optimisticCompleted && hovering && !isPending;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
      <button
        onClick={handleClick}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        disabled={isPending}
        className={cn(
          "flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 w-full sm:w-auto",
          optimisticCompleted
            ? showUnmarkState
              ? "bg-red-50 border border-red-200 text-red-500 cursor-pointer"
              : "bg-[#72CF92]/15 text-[#72CF92] border border-transparent cursor-pointer"
            : "bg-white border border-border hover:border-[#6699F3] hover:text-[#6699F3] text-foreground cursor-pointer"
        )}
        aria-label={optimisticCompleted ? "Desmarcar aula como concluída" : "Marcar aula como concluída"}
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : showUnmarkState ? (
          <XCircle className="w-4 h-4" />
        ) : optimisticCompleted ? (
          <CheckCircle2 className="w-4 h-4" />
        ) : (
          <Circle className="w-4 h-4" />
        )}
        {showUnmarkState
          ? "Desmarcar aula"
          : optimisticCompleted
          ? "Aula concluída"
          : "Marcar como concluída"}
      </button>

      {error && (
        <span className="flex items-center gap-1 text-xs text-red-500">
          <AlertCircle className="w-3.5 h-3.5" />
          Erro ao salvar. Tente novamente.
        </span>
      )}
    </div>
  );
}
