"use client";

import { isAllowedEmbedUrl } from "@/lib/sanitize";
import { AlertCircle } from "lucide-react";
import { useEffect, useRef } from "react";

interface EmbedBlockProps {
  url: string;
  title?: string;
  height?: number;
}

export default function EmbedBlock({ url, title = "Conteúdo incorporado", height = 480 }: EmbedBlockProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    function setHeight(h: number) {
      if (iframe && h > 50) iframe.style.height = h + "px";
    }

    // Leitura inicial para HTMLs estáticos (sem postMessage)
    function onLoad() {
      try {
        const doc = iframe?.contentDocument;
        if (!doc?.body) return;
        const h = Math.max(
          doc.documentElement?.offsetHeight ?? 0,
          doc.body.offsetHeight,
          doc.documentElement?.scrollHeight ?? 0,
          doc.body.scrollHeight
        );
        setHeight(h);
      } catch { /* cross-origin — postMessage cobre */ }
    }

    // postMessage: HTMLs dinâmicos (receitas.html) enviam altura quando mudam
    function onMessage(e: MessageEvent) {
      if (e.data?.type === "handify-resize" && typeof e.data.height === "number") {
        setHeight(e.data.height);
      }
    }

    iframe.addEventListener("load", onLoad);
    window.addEventListener("message", onMessage);

    return () => {
      iframe.removeEventListener("load", onLoad);
      window.removeEventListener("message", onMessage);
    };
  }, []);

  if (!isAllowedEmbedUrl(url)) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100">
        <AlertCircle className="w-4 h-4 shrink-0" />
        Domínio não permitido para embed.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border shadow-sm overflow-hidden">
      <iframe
        ref={iframeRef}
        src={url}
        title={title}
        width="100%"
        height={height}
        className="border-0 block"
        loading="lazy"
        allow="camera; microphone; fullscreen"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
}
