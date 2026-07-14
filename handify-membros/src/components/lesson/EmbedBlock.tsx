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
    function handler(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return;
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
      />
    </div>
  );
}
