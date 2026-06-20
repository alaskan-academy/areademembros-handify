"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { FileText, Code, Globe, Download } from "lucide-react";

const HtmlBlock = dynamic(() => import("./html-block"), { ssr: false });
const EmbedBlock = dynamic(() => import("./embed-block"), { ssr: false });

export type BlockType = "text" | "html" | "embed" | "download";

export interface ContentBlock {
  id: string;
  type: BlockType;
  content: string; // JSON string
  position: number;
}

export interface LessonMaterial {
  id: string;
  name: string;
  signed_url: string | null;
}

function parseContent(content: string): Record<string, unknown> {
  try {
    return JSON.parse(content);
  } catch {
    return { body: content };
  }
}

function TextBlock({ content }: { content: string }) {
  const parsed = parseContent(content);
  const body = (parsed.body as string) ?? content;
  return (
    <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
      {body}
    </div>
  );
}

function DownloadBlock({ material }: { material?: LessonMaterial }) {
  if (!material) return null;
  return (
    <div className="flex items-center justify-between gap-4 p-4 rounded-lg border border-border bg-muted/40 hover:bg-muted/70 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-[#6699F3]/10 flex items-center justify-center shrink-0">
          <Download className="w-4 h-4 text-[#6699F3]" />
        </div>
        <span className="text-sm font-medium truncate">{material.name}</span>
      </div>
      {material.signed_url ? (
        <a
          href={material.signed_url}
          download
          className="text-xs font-semibold text-[#6699F3] hover:text-[#5580d4] shrink-0 transition-colors"
        >
          Baixar
        </a>
      ) : (
        <span className="text-xs text-muted-foreground shrink-0">Indisponível</span>
      )}
    </div>
  );
}

const BLOCK_ICONS: Record<BlockType, React.ElementType> = {
  text: FileText,
  html: Code,
  embed: Globe,
  download: Download,
};

interface ContentBlocksProps {
  blocks: ContentBlock[];
  materials: LessonMaterial[];
}

export default function ContentBlocks({ blocks, materials }: ContentBlocksProps) {
  if (!blocks.length && !materials.length) return null;

  const materialById = Object.fromEntries(materials.map((m) => [m.id, m]));

  return (
    <div className="space-y-6 pt-4 border-t border-border">
      {blocks.map((block) => {
        const parsed = parseContent(block.content);

        return (
          <div key={block.id} className="space-y-2">
            {block.type === "text" && (
              <TextBlock content={block.content} />
            )}

            {block.type === "html" && (
              <Suspense fallback={<div className="h-20 bg-muted animate-pulse rounded-lg" />}>
                <HtmlBlock html={(parsed.html as string) ?? (parsed.body as string) ?? ""} />
              </Suspense>
            )}

            {block.type === "embed" && (
              <Suspense fallback={<div className="h-48 bg-muted animate-pulse rounded-lg" />}>
                <EmbedBlock
                  url={(parsed.url as string) ?? ""}
                  title={(parsed.title as string) ?? undefined}
                  height={(parsed.height as number) ?? undefined}
                />
              </Suspense>
            )}

            {block.type === "download" && (
              <DownloadBlock
                material={materialById[parsed.material_id as string]}
              />
            )}
          </div>
        );
      })}

      {/* Materiais avulsos (sem bloco download) */}
      {materials.filter((m) => {
        const referencedIds = blocks
          .filter((b) => b.type === "download")
          .map((b) => {
            try { return (JSON.parse(b.content) as { material_id: string }).material_id; }
            catch { return null; }
          })
          .filter(Boolean);
        return !referencedIds.includes(m.id);
      }).length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Materiais da aula
          </p>
          {materials
            .filter((m) => {
              const referencedIds = blocks
                .filter((b) => b.type === "download")
                .map((b) => {
                  try { return (JSON.parse(b.content) as { material_id: string }).material_id; }
                  catch { return null; }
                })
                .filter(Boolean);
              return !referencedIds.includes(m.id);
            })
            .map((m) => (
              <DownloadBlock key={m.id} material={m} />
            ))}
        </div>
      )}
    </div>
  );
}
