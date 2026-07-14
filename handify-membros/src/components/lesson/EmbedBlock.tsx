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

    // Once a postMessage arrives we know the iframe manages its own height;
    // stop the static-fallback poll so it can't override the iframe's values.
    let dynamicMode = false;
    const retryTimers: ReturnType<typeof setTimeout>[] = [];

    function applyHeight(h: number) {
      const el = iframeRef.current;
      if (!el || h < 50) return;
      el.style.height = h + "px";
    }

    function measureStatic() {
      if (dynamicMode) return;
      try {
        const doc = iframeRef.current?.contentDocument;
        if (!doc?.body) return;
        // scrollHeight is reliable for full-page height even in quirks mode
        const h = Math.max(
          doc.documentElement.scrollHeight,
          doc.documentElement.offsetHeight,
          doc.body.scrollHeight,
          doc.body.offsetHeight
        );
        applyHeight(h);
      } catch { /* cross-origin */ }
    }

    function onLoad() {
      // Immediate read + 3 retries to catch font/image layout shifts.
      // Stops as soon as the iframe sends its own height via postMessage.
      measureStatic();
      [150, 600, 1500].forEach((delay) => {
        retryTimers.push(setTimeout(measureStatic, delay));
      });
    }

    // Dynamic HTMLs (e.g. receitas.html) send height via postMessage on each
    // view change. As soon as the first message arrives we trust the iframe
    // completely and cancel the static retries.
    function onMessage(e: MessageEvent) {
      if (e.data?.type === "handify-resize" && typeof e.data.height === "number") {
        if (!dynamicMode) {
          dynamicMode = true;
          retryTimers.forEach(clearTimeout);
          retryTimers.length = 0;
        }
        applyHeight(e.data.height);
      }
    }

    iframe.addEventListener("load", onLoad);
    window.addEventListener("message", onMessage);

    return () => {
      iframe.removeEventListener("load", onLoad);
      window.removeEventListener("message", onMessage);
      retryTimers.forEach(clearTimeout);
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
