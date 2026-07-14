"use client";

import { isAllowedEmbedUrl } from "@/lib/sanitize";
import { AlertCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface EmbedBlockProps {
  url: string;
  title?: string;
  height?: number;
}

export default function EmbedBlock({ url, title = "Conteúdo incorporado", height = 480 }: EmbedBlockProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(height);

  // Lê altura diretamente do DOM do iframe (funciona para iframes same-origin)
  const readHeight = useCallback(() => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;
      const h = doc.documentElement?.scrollHeight ?? doc.body?.scrollHeight;
      if (h && h > 100) setIframeHeight(h + 24);
    } catch {
      // cross-origin — postMessage vai cobrir
    }
  }, []);

  useEffect(() => {
    // Recebe notifyHeight() do iframe — sem verificar source para evitar
    // falsos negativos com WindowProxy em alguns browsers
    function handler(event: MessageEvent) {
      if (event.data?.type === "handify-resize" && typeof event.data.height === "number") {
        setIframeHeight(event.data.height + 24);
      }
    }
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
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
        onLoad={readHeight}
      />
    </div>
  );
}
