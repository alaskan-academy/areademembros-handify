"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

// Script injetado no srcdoc:
// 1. Remove min-height do html/body (evita que 100vh prenda a altura ao tamanho do iframe)
// 2. Após qualquer mutação de DOM, faz poll a cada 100ms por 1,5s para capturar
//    qualquer duração de transição CSS (expansão E colapso de accordions, tabs, etc.)
const RESIZE_SCRIPT = `
<style>html,body{min-height:0!important;height:auto!important}</style>
<script>
(function(){
  var _last=0,_t=null;
  function send(){
    var h=document.body?document.body.scrollHeight:document.documentElement.scrollHeight;
    if(h>0&&h!==_last){_last=h;try{window.parent.postMessage({type:'handify-resize',height:h},'*');}catch(e){}}
  }
  function poll(){
    clearTimeout(_t);
    var n=0;
    (function tick(){send();n++;if(n<15)_t=setTimeout(tick,100);})();
  }
  function init(){
    // Retries forçados: resetam _last para re-enviar mesmo que altura não mude,
    // garantindo que o listener React (attachado via useEffect após mount) receba.
    send();
    setTimeout(function(){_last=0;send();},300);
    setTimeout(function(){_last=0;send();},1000);
    setTimeout(function(){_last=0;send();},2500);
    if(!window.MutationObserver)return;
    new MutationObserver(function(){requestAnimationFrame(send);poll();})
      .observe(document.body||document.documentElement,{childList:true,subtree:true,attributes:true});
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init);}else{init();}
})();
<\/script>`;

// HTML completo (<!DOCTYPE ou <html>) → iframe srcdoc que se auto-ajusta à altura do conteúdo
function HtmlDocument({ html }: { html: string }) {
  const [height, setHeight] = useState(400);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Injeta o script de resize no srcdoc antes de renderizar
  const docWithScript = useMemo(() => {
    if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${RESIZE_SCRIPT}</body>`);
    if (/<\/html>/i.test(html)) return html.replace(/<\/html>/i, `${RESIZE_SCRIPT}</html>`);
    return html + RESIZE_SCRIPT;
  }, [html]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (
        e.data?.type === "handify-resize" &&
        typeof e.data.height === "number" &&
        e.data.height > 50 &&
        // Garante que o postMessage veio do nosso iframe específico
        iframeRef.current?.contentWindow === e.source
      ) {
        setHeight(e.data.height);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <div className="w-full overflow-hidden rounded-xl border border-border shadow-sm">
      <iframe
        ref={iframeRef}
        srcDoc={docWithScript}
        title="Conteúdo personalizado"
        className="w-full border-0 block"
        style={{ height }}
        scrolling="no"
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
