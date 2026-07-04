"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sanitizeHtml } from "@/lib/sanitize";

function HtmlSnippet({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.querySelectorAll("a[href]").forEach((a) => {
        const el = a as HTMLAnchorElement;
        if (el.hostname && el.hostname !== window.location.hostname) {
          el.target = "_blank";
          el.rel = "noopener noreferrer";
        }
      });
    }
  }, [html]);

  return (
    <div
      ref={ref}
      className="prose prose-sm max-w-none text-foreground
        prose-headings:font-semibold prose-headings:text-foreground
        prose-a:text-[#6699F3] prose-a:no-underline hover:prose-a:underline
        prose-blockquote:border-l-[#6699F3] prose-blockquote:text-muted-foreground
        prose-code:bg-muted prose-code:px-1 prose-code:rounded prose-code:text-sm
        prose-img:rounded-lg"
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  );
}

// HTML completo (<!DOCTYPE ou <html>) → iframe srcdoc que se auto-ajusta à altura do conteúdo
function HtmlDocument({ html }: { html: string }) {
  const [height, setHeight] = useState(400);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Lê a altura diretamente do DOM do iframe (funciona porque o sandbox tem allow-same-origin)
  const measure = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
      if (!doc?.body) return;
      const h = Math.max(
        doc.body.scrollHeight,
        doc.documentElement?.scrollHeight ?? 0,
      );
      if (h > 50) setHeight(h);
    } catch {
      // cross-origin inesperado — ignora
    }
  }, []);

  const handleLoad = useCallback(() => {
    measure();
    // Re-mede após carregamento de fontes web (Google Fonts altera o layout)
    setTimeout(measure, 300);
    setTimeout(measure, 1000);
  }, [measure]);

  return (
    <div className="w-full overflow-hidden rounded-xl border border-border shadow-sm">
      <iframe
        ref={iframeRef}
        srcDoc={html}
        title="Conteúdo personalizado"
        className="w-full border-0 block"
        style={{ height }}
        scrolling="no"
        onLoad={handleLoad}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
      />
    </div>
  );
}

export default function HtmlBlock({ html }: { html: string }) {
  const isFullDocument = /^\s*(<!DOCTYPE|<html)/i.test(html);

  if (isFullDocument) {
    return <HtmlDocument html={html} />;
  }

  return <HtmlSnippet html={html} />;
}
