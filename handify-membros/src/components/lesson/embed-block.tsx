"use client";

import { isAllowedEmbedUrl } from "@/lib/sanitize";
import { AlertCircle } from "lucide-react";

interface EmbedBlockProps {
  url: string;
  title?: string;
  height?: number;
}

export default function EmbedBlock({ url, title = "Conteúdo incorporado", height = 480 }: EmbedBlockProps) {
  if (!isAllowedEmbedUrl(url)) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100">
        <AlertCircle className="w-4 h-4 shrink-0" />
        Domínio não permitido para embed.
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-border shadow-sm">
      <iframe
        src={url}
        title={title}
        width="100%"
        height={height}
        className="border-0 block"
        loading="lazy"
        allow="camera; microphone; fullscreen"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );
}
