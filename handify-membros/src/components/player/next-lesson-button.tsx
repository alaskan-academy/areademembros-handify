"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2 } from "lucide-react";
import { markLessonComplete } from "@/app/(student)/aulas/actions";

interface NextLessonButtonProps {
  nextLessonId: string;
  lessonId: string;
  isCompleted: boolean;
  hasVideo: boolean;
}

export default function NextLessonButton({
  nextLessonId,
  lessonId,
  isCompleted,
  hasVideo,
}: NextLessonButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (isPending) return;

    if (!hasVideo && !isCompleted) {
      startTransition(async () => {
        await markLessonComplete(lessonId).catch(() => {});
        router.push(`/aulas/${nextLessonId}`);
      });
    } else {
      router.push(`/aulas/${nextLessonId}`);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="flex items-center justify-center gap-1.5 text-sm font-medium text-white bg-[#6699F3] hover:bg-[#5580d4] active:bg-[#4a70c0] transition-colors px-3 py-2.5 min-h-[44px] rounded-lg disabled:opacity-70"
    >
      {isPending ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          Salvando...
        </>
      ) : (
        <>
          Próxima
          <ChevronRight className="w-4 h-4 shrink-0" />
        </>
      )}
    </button>
  );
}
