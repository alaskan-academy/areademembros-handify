"use client";

import { useEffect, useRef, useCallback } from "react";
import { savePosition, markLessonComplete } from "@/app/(student)/aulas/actions";

interface PandaPlayerProps {
  videoId: string;
  lessonId: string;
  initialPosition?: number;
  durationSeconds?: number;
  isCompleted?: boolean;
}

export default function PandaPlayer({
  videoId,
  lessonId,
  initialPosition = 0,
  durationSeconds = 0,
  isCompleted = false,
}: PandaPlayerProps) {
  const positionRef = useRef(initialPosition);
  // Impede auto-mark duplo: começa true se já está concluída no servidor
  const autoMarkedRef = useRef(isCompleted);

  const flushPosition = useCallback(() => {
    // Salva APENAS posição — nunca altera completed
    savePosition(lessonId, positionRef.current).catch(() => {});
  }, [lessonId]);

  useEffect(() => {
    autoMarkedRef.current = isCompleted;
  }, [isCompleted]);

  useEffect(() => {
    const timer = setInterval(() => {
      positionRef.current += 10;

      // Auto-mark ao atingir 90% da duração (apenas uma vez)
      if (
        !autoMarkedRef.current &&
        durationSeconds > 0 &&
        positionRef.current >= durationSeconds * 0.9
      ) {
        autoMarkedRef.current = true;
        markLessonComplete(lessonId).catch(() => {});
      }

      flushPosition();
    }, 10_000);

    return () => {
      clearInterval(timer);
      // Salva posição ao sair — NÃO altera completed
      flushPosition();
    };
  }, [lessonId, durationSeconds, flushPosition]);

  // Se for URL completa do Panda Video, usa direto; senão constrói com o UUID
  const embedUrl = videoId.startsWith("http")
    ? videoId
    : `https://player.pandavideo.com.br/embed/?v=${encodeURIComponent(videoId)}`;

  return (
    <div className="w-full aspect-video rounded-xl overflow-hidden bg-black shadow-lg">
      <iframe
        src={embedUrl}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        className="w-full h-full border-0"
        title="Aula em vídeo"
      />
    </div>
  );
}
