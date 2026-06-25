"use client";

import { useEffect, useRef } from "react";
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

// HTML completo (<!DOCTYPE ou <html>) → iframe srcdoc sandboxado (CSS + JS funcionam)
function HtmlDocument({ html, height = 600 }: { html: string; height?: number }) {
  return (
    <div className="rounded-xl overflow-hidden border border-border shadow-sm">
      <iframe
        srcDoc={html}
        title="Conteúdo personalizado"
        className="w-full border-0 block"
        style={{ height }}
        sandbox="allow-scripts allow-popups allow-forms"
        loading="lazy"
      />
    </div>
  );
}

export default function HtmlBlock({
  html,
  iframeHeight,
}: {
  html: string;
  iframeHeight?: number;
}) {
  const isFullDocument = /^\s*(<!DOCTYPE|<html)/i.test(html);

  if (isFullDocument) {
    return <HtmlDocument html={html} height={iframeHeight} />;
  }

  return <HtmlSnippet html={html} />;
}
