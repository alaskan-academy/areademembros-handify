"use client";

import { isAllowedEmbedUrl } from "@/lib/sanitize";
import { AlertCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface EmbedBlockProps {
  url: string;
  title?: string;
  height?: number;
}

export default function EmbedBlock({ url, title = "Conteúdo incorporado", height = 480 }: EmbedBlockProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(height);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    let observer: MutationObserver | null = null;

    function readHeight() {
      try {
        const doc = iframe?.contentDocument;
        if (!doc) return;
        const h = Math.max(
          doc.documentElement?.scrollHeight ?? 0,
          doc.body?.scrollHeight ?? 0
        );
        if (h > 100) setIframeHeight(h + 24);
      } catch {
        // cross-origin — postMessage cobre
      }
    }

    function setup() {
      try {
        const doc = iframe?.contentDocument;
        if (!doc?.body) return;
        observer?.disconnect();
        // MutationObserver dispara exatamente quando o SPA muda o DOM interno
        // (ex: showRecipe seta innerHTML) — sem depender de timers
        observer = new MutationObserver(readHeight);
        observer.observe(doc.body, { childList: true, subtree: true });
        readHeight();
      } catch {
        // cross-origin — postMessage cobre
      }
    }

    iframe.addEventListener("load", setup);
    setup(); // já carregado

    // postMessage como backup (ex: antes do observer estar pronto)
    function onMessage(event: MessageEvent) {
      if (event.data?.type === "handify-resize" && typeof event.data.height === "number") {
        setIframeHeight(event.data.height + 24);
      }
    }
    window.addEventListener("message", onMessage);

    return () => {
      observer?.disconnect();
      iframe.removeEventListener("load", setup);
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
        height={iframeHeight}
        className="border-0 block"
        loading="lazy"
        allow="camera; microphone; fullscreen"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
}
