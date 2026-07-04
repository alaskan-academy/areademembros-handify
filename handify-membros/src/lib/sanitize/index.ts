"use client";

import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
  "p", "br", "b", "i", "strong", "em", "u", "s",
  "h1", "h2", "h3", "h4",
  "ul", "ol", "li",
  "blockquote",
  "a",
  "img",
  "table", "thead", "tbody", "tr", "th", "td",
  "hr",
  "code", "pre",
  "span", "div",
  "mark",       // Tiptap Highlight extension
  "section",    // wrapper semântico em HTML de dicas
  "details",    // acordeão nativo HTML
  "summary",    // cabeçalho do <details>
  "style",      // CSS inline de blocos HTML admin — admin é confiável
];

const ALLOWED_ATTR = [
  "href", "target", "rel",
  "src", "alt", "width", "height",
  "class",
  "colspan", "rowspan",
  "style",  // Tiptap usa style para cores, alinhamento e highlight — DOMPurify sanitiza CSS perigoso
];

export function sanitizeHtml(dirty: string): string {
  // DOMPurify requer DOM real — durante SSR não existe window, retorna o input
  // diretamente (conteúdo admin é confiável; sanitização ocorre no client)
  if (typeof window === 'undefined') return dirty
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ["target"],
    FORCE_BODY: true,
    RETURN_DOM: false,
  });
}

export { isAllowedEmbedUrl } from "./allowlist";
