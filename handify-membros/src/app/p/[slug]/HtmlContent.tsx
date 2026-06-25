"use client";

import { sanitizeHtml } from "@/lib/sanitize";

export default function HtmlContent({ html }: { html: string }) {
  return (
    <div
      className="prose prose-sm sm:prose max-w-none"
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  );
}
