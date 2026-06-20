"use client";

import { useEffect, useRef } from "react";
import { sanitizeHtml } from "@/lib/sanitize";

export default function HtmlBlock({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      // Forçar links externos a abrirem em nova aba com rel seguro
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
      // sanitizeHtml roda no client — seguro com DOMPurify
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  );
}
