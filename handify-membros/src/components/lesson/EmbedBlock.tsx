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
    let ro: ResizeObserver | null = null;

    function fit() {
      const el = iframeRef.current;
      if (!el) return;
      try {
        const doc = el.contentDocument;
        if (!doc?.body) return;
        // scrollHeight reflete altura real após reflow (ResizeObserver garante isso)
        const h = Math.max(
          doc.documentElement?.scrollHeight ?? 0,
          doc.body.scrollHeight
        );
        if (h > 0) el.style.height = h + "px";
      } catch {}
    }

    function setup() {
      const el = iframeRef.current;
      if (!el) return;
      try {
        const doc = el.contentDocument;
        if (!doc?.body) return;
        ro?.disconnect();
        // ResizeObserver dispara após layout — captura expansão E redução do conteúdo
        ro = new ResizeObserver(fit);
        ro.observe(doc.body);
        fit();
      } catch {}
    }

    iframe.addEventListener("load", setup);
    setup();

    function onMessage(e: MessageEvent) {
      const el = iframeRef.current;
      if (!el) return;
      if (e.data?.type === "handify-resize" && typeof e.data.height === "number") {
        el.style.height = e.data.height + "px";
      }
    }
    window.addEventListener("message", onMessage);

    return () => {
      ro?.disconnect();
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
