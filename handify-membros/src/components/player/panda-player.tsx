"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const positionRef = useRef(initialPosition);
  const autoMarkedRef = useRef(isCompleted);
  // Duração: inicia com prop, pode ser atualizada via postMessage do player
  const durationRef = useRef(durationSeconds);

  const flushPosition = useCallback(() => {
    savePosition(lessonId, positionRef.current).catch(() => {});
  }, [lessonId]);

  // Marca concluída e atualiza UI via router.refresh()
  const autoMark = useCallback(() => {
    if (autoMarkedRef.current) return;
    autoMarkedRef.current = true;
    markLessonComplete(lessonId)
      .then(() => router.refresh())
      .catch(() => {});
  }, [lessonId, router]);

  useEffect(() => {
    autoMarkedRef.current = isCompleted;
  }, [isCompleted]);

  useEffect(() => {
    // Só atualiza durationRef se não recebemos dado melhor do player
    if (durationSeconds > 0 && durationRef.current === 0) {
      durationRef.current = durationSeconds;
    }
  }, [durationSeconds]);

  // Listener de postMessage: sem filtro de origem para compatibilidade máxima
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      let data: Record<string, unknown> | null = null;

      if (typeof event.data === "string") {
        try { data = JSON.parse(event.data); } catch { return; }
      } else if (event.data && typeof event.data === "object") {
        data = event.data as Record<string, unknown>;
      }
      if (!data) return;

      const eventName = String(data.event ?? data.type ?? "").toLowerCase();
      if (!eventName) return;

      // Vídeo finalizado → marca imediatamente
      if (eventName === "ended" || eventName === "pandavideo:ended" || eventName === "finish") {
        autoMark();
        return;
      }

      // timeupdate → posição e duração reais do player
      if (eventName === "timeupdate" || eventName === "pandavideo:timeupdate" || eventName === "progress") {
        const ct = typeof data.currentTime === "number" ? data.currentTime : null;
        const dur = typeof data.duration === "number" ? data.duration : null;

        if (ct !== null) positionRef.current = Math.floor(ct);
        if (dur && dur > 0) durationRef.current = dur;

        if (durationRef.current > 0 && positionRef.current >= durationRef.current * 0.9) {
          autoMark();
        }
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [autoMark]);

  // Timer de fallback: conta tempo real decorrido desde que abriu a aula.
  // Funciona mesmo sem postMessage e sem duration cadastrada (usa durationRef que
  // pode ser preenchida pelo postMessage durante a sessão).
  useEffect(() => {
    const startPos = initialPosition;
    const startTime = Date.now();

    const timer = setInterval(() => {
      // Posição estimada = posição inicial + segundos reais desde abertura
      const realElapsed = (Date.now() - startTime) / 1000;
      const estimated = Math.floor(startPos + realElapsed);
      // Só avança posição estimada se postMessage não deu dado melhor
      positionRef.current = Math.max(positionRef.current, estimated);

      flushPosition();

      const dur = durationRef.current;
      if (dur > 0 && positionRef.current >= dur * 0.9) {
        autoMark();
      }
    }, 10_000);

    return () => {
      clearInterval(timer);
      flushPosition();
    };
  // lessonId/initialPosition mudam ao trocar de aula — reinicia o timer
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, initialPosition]);

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
