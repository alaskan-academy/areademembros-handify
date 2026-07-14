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
    let lastH = 0;

    function applyHeight(h: number) {
      if (!iframe || h < 50) return;
      if (Math.abs(h - lastH) > 2) {
        lastH = h;
        iframe.style.height = h + "px";
      }
    }

    // Camada 1: postMessage enviado pelo HTML dinâmico (receitas.html)
    function onMessage(e: MessageEvent) {
      if (e.data?.type === "handify-resize" && typeof e.data.height === "number") {
        applyHeight(e.data.height);
      }
    }
    window.addEventListener("message", onMessage);

    // Camada 2: polling direto no body do iframe (funciona para qualquer HTML same-origin)
    // body.offsetHeight retorna a altura real do elemento, não do viewport
    function poll() {
      try {
        const doc = iframe?.contentDocument;
        if (!doc?.body) return;
        applyHeight(doc.body.offsetHeight);
      } catch { /* cross-origin */ }
    }

    iframe.addEventListener("load", poll);
    const interval = setInterval(poll, 300);

    return () => {
      window.removeEventListener("message", onMessage);
      iframe.removeEventListener("load", poll);
      clearInterval(interval);
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
