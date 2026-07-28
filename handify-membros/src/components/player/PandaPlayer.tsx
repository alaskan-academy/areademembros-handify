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

function isYouTube(value: string): boolean {
  return value.includes("youtube.com") || value.includes("youtu.be");
}

function extractYouTubeId(value: string): string | null {
  // https://www.youtube.com/watch?v=ID
  let m = value.match(/[?&]v=([^&#]+)/);
  if (m) return m[1];
  // https://youtu.be/ID
  m = value.match(/youtu\.be\/([^?&#]+)/);
  if (m) return m[1];
  // https://www.youtube.com/embed/ID
  m = value.match(/\/embed\/([^?&#]+)/);
  if (m) return m[1];
  return null;
}

function buildYouTubeEmbedUrl(value: string): string {
  const id = extractYouTubeId(value) ?? value;
  // youtube-nocookie.com: domínio de privacidade — sem cookies de rastreamento
  // rel=0: sem vídeos relacionados  |  modestbranding=1: branding mínimo
  // iv_load_policy=3: sem anotações  |  disablekb=1: sem atalhos de teclado
  // enablejsapi=1: habilita postMessage para eventos do player
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&enablejsapi=1`;
}

function buildPandaEmbedUrl(videoId: string): string {
  return videoId.startsWith("http")
    ? videoId
    : `https://player.pandavideo.com.br/embed/?v=${encodeURIComponent(videoId)}`;
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
  const durationRef = useRef(durationSeconds);

  const youtube = isYouTube(videoId);
  const embedUrl = youtube ? buildYouTubeEmbedUrl(videoId) : buildPandaEmbedUrl(videoId);

  const flushPosition = useCallback(() => {
    savePosition(lessonId, positionRef.current).catch(() => {});
  }, [lessonId]);

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
    if (durationSeconds > 0 && durationRef.current === 0) {
      durationRef.current = durationSeconds;
    }
  }, [durationSeconds]);

  // postMessage: trata eventos do Panda Video e da YouTube IFrame API
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

      // YouTube IFrame API: { event: "onStateChange", info: 0 } → 0 = ended
      if (eventName === "onstatechange" && data.info === 0) {
        autoMark();
        return;
      }

      if (eventName === "ended" || eventName === "pandavideo:ended" || eventName === "finish") {
        autoMark();
        return;
      }

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

  // Timer de fallback: funciona para Panda e YouTube (cross-origin — postMessage pode não chegar)
  useEffect(() => {
    const startPos = initialPosition;
    const startTime = Date.now();

    const timer = setInterval(() => {
      const realElapsed = (Date.now() - startTime) / 1000;
      const estimated = Math.floor(startPos + realElapsed);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, initialPosition]);

  return (
    <div className="w-full aspect-video rounded-xl overflow-hidden bg-black shadow-lg relative">
      <iframe
        src={embedUrl}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        className="w-full h-full border-0"
        title="Aula em vídeo"
      />
      {/* Camada que captura clique direito no container — dificulta compartilhamento para usuárias não técnicas */}
      {youtube && (
        <div
          className="absolute inset-0 pointer-events-none"
          onContextMenu={(e) => e.preventDefault()}
        />
      )}
    </div>
  );
}
