"use client";

import { useEffect, useRef, useState } from "react";
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

// Injeta script no HTML do iframe que reporta a altura real do conteúdo via postMessage
function injectResizeScript(html: string, token: string): string {
  const script = `<script>
(function(){
  var tok='${token}';
  function report(){
    var h=Math.max(
      document.body.scrollHeight||0,
      document.documentElement.scrollHeight||0,
      document.body.offsetHeight||0,
      document.documentElement.offsetHeight||0
    );
    window.parent.postMessage({type:'handify-iframe-resize',token:tok,height:h},'*');
  }
  if(document.readyState==='complete'){report();}
  window.addEventListener('load',report);
  if(typeof ResizeObserver!=='undefined'){new ResizeObserver(report).observe(document.body);}
})();
<\/script>`;
  return html.includes("</body>")
    ? html.replace("</body>", script + "</body>")
    : html + script;
}

// HTML completo (<!DOCTYPE ou <html>) → iframe srcdoc que se auto-ajusta à altura do conteúdo
function HtmlDocument({ html }: { html: string }) {
  const [height, setHeight] = useState(600);
  const token = useState(() => `ht-${Math.random().toString(36).slice(2)}`)[0];

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (
        e.data?.type === "handify-iframe-resize" &&
        e.data?.token === token &&
        typeof e.data?.height === "number" &&
        e.data.height > 0
      ) {
        setHeight(e.data.height);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [token]);

  return (
    <div className="w-full overflow-hidden rounded-xl border border-border shadow-sm">
      <iframe
        srcDoc={injectResizeScript(html, token)}
        title="Conteúdo personalizado"
        className="w-full border-0 block"
        style={{ height }}
        scrolling="no"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
        loading="lazy"
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
