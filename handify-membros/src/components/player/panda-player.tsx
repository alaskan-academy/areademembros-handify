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
  const autoMarkedRef = useRef(isCompleted);
  // Duração real vinda do player via postMessage (sobrescreve prop se disponível)
  const durationRef = useRef(durationSeconds);

  const flushPosition = useCallback(() => {
    savePosition(lessonId, positionRef.current).catch(() => {});
  }, [lessonId]);

  const autoMark = useCallback(() => {
    if (autoMarkedRef.current) return;
    autoMarkedRef.current = true;
    markLessonComplete(lessonId).catch(() => {});
  }, [lessonId]);

  useEffect(() => {
    autoMarkedRef.current = isCompleted;
  }, [isCompleted]);

  useEffect(() => {
    durationRef.current = durationSeconds;
  }, [durationSeconds]);

  // Escuta eventos reais do player Panda Video via postMessage
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!event.origin.includes("pandavideo.com")) return;

      let data: Record<string, unknown> | null = null;
      if (typeof event.data === "string") {
        try { data = JSON.parse(event.data); } catch { return; }
      } else if (event.data && typeof event.data === "object") {
        data = event.data as Record<string, unknown>;
      }
      if (!data) return;

      const eventName = (data.event ?? data.type) as string | undefined;

      // Vídeo finalizado → marca concluída imediatamente
      if (eventName === "ended" || eventName === "pandavideo:ended") {
        autoMark();
        return;
      }

      // timeupdate → atualiza posição real e verifica 90%
      if (eventName === "timeupdate" || eventName === "pandavideo:timeupdate") {
        const currentTime = typeof data.currentTime === "number" ? data.currentTime : null;
        const duration = typeof data.duration === "number" ? data.duration : null;

        if (currentTime !== null) {
          positionRef.current = Math.floor(currentTime);
        }
        if (duration && duration > 0) {
          durationRef.current = duration;
        }

        const dur = durationRef.current;
        if (dur > 0 && positionRef.current >= dur * 0.9) {
          autoMark();
        }
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [autoMark]);

  // Fallback timer: verifica 90% com duração cadastrada (cobre velocidade 1x sem postMessage)
  useEffect(() => {
    if (!durationSeconds) return;

    let elapsed = initialPosition;
    const timer = setInterval(() => {
      elapsed += 10;
      positionRef.current = Math.max(positionRef.current, elapsed);

      if (durationRef.current > 0 && elapsed >= durationRef.current * 0.9) {
        autoMark();
        clearInterval(timer);
      }
    }, 10_000);

    return () => clearInterval(timer);
  }, [lessonId, durationSeconds, initialPosition, autoMark]);

  // Salva posição no banco a cada 10s e ao sair da página
  useEffect(() => {
    const timer = setInterval(flushPosition, 10_000);
    return () => {
      clearInterval(timer);
      flushPosition();
    };
  }, [flushPosition]);

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
