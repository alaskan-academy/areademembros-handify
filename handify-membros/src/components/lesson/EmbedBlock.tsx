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
    let observer: MutationObserver | null = null;

    // Manipula o DOM diretamente — sem passar por React state/re-render
    function fit() {
      try {
        const doc = iframe?.contentDocument;
        if (!doc?.body) return;
        const h = Math.max(
          doc.documentElement?.scrollHeight ?? 0,
          doc.body.scrollHeight
        );
        if (h > 100) iframe.style.height = h + "px";
      } catch {
        // cross-origin sem allow-same-origin — postMessage cobre
      }
    }

    function setup() {
      fit();
      try {
        const doc = iframe?.contentDocument;
        if (!doc?.body) return;
        observer?.disconnect();
        // MutationObserver dispara imediatamente quando showRecipe() faz innerHTML=
        observer = new MutationObserver(fit);
        observer.observe(doc.body, { childList: true, subtree: true });
      } catch {}
    }

    iframe.addEventListener("load", setup);
    setup(); // já carregado

    function onMessage(e: MessageEvent) {
      if (e.data?.type === "handify-resize" && typeof e.data.height === "number") {
        iframe.style.height = e.data.height + "px";
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
        height={height}
        className="border-0 block"
        loading="lazy"
        allow="camera; microphone; fullscreen"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
}
