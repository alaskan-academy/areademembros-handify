"use client";

import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
  "p", "br", "b", "i", "strong", "em", "u", "s",
  "h2", "h3", "h4",
  "ul", "ol", "li",
  "blockquote",
  "a",
  "img",
  "table", "thead", "tbody", "tr", "th", "td",
  "hr",
  "code", "pre",
  "span", "div",
];

const ALLOWED_ATTR = [
  "href", "target", "rel",
  "src", "alt", "width", "height",
  "class", "style",
  "colspan", "rowspan",
];

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ["target"],
    FORCE_BODY: true,
    RETURN_DOM: false,
  });
}

const EMBED_ALLOWLIST = [
  "docs.google.com",
  "forms.gle",
  "typeform.com",
  "notion.so",
  "canva.com",
  "youtube.com",
  "youtu.be",
  "www.youtube.com",
];

export function isAllowedEmbedUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return EMBED_ALLOWLIST.some((allowed) =>
      hostname === allowed || hostname.endsWith(`.${allowed}`)
    );
  } catch {
    return false;
  }
}
