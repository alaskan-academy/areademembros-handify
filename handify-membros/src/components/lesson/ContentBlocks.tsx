"use client";

import { Suspense, useState } from "react";
import dynamic from "next/dynamic";
import { FileText, Code, Globe, Download, ChevronDown, ChevronUp } from "lucide-react";

const HtmlBlock = dynamic(() => import("./HtmlBlock"), { ssr: false });
const EmbedBlock = dynamic(() => import("./EmbedBlock"), { ssr: false });
const PandaPlayer = dynamic(() => import("@/components/player/PandaPlayer"), { ssr: false });

export type BlockType = "text" | "html" | "embed" | "download" | "video";

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

export interface VideoPlayerProps {
  lessonId: string;
  initialPosition: number;
  durationSeconds: number;
  isCompleted: boolean;
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
  const html = parsed.html as string | undefined;
  const body = parsed.body as string | undefined;

  if (html) {
    return (
      <Suspense fallback={<div className="h-8 bg-muted animate-pulse rounded" />}>
        <HtmlBlock html={html} />
      </Suspense>
    );
  }

  return (
    <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
      {body ?? content}
    </div>
  );
}

function VideoBlock({
  content,
  videoPlayerProps,
}: {
  content: string;
  videoPlayerProps?: VideoPlayerProps;
}) {
  const parsed = parseContent(content);
  const videoId = parsed.video_panda_id as string | undefined;

  if (!videoId) return null;

  if (!videoPlayerProps) {
    return (
      <div className="w-full aspect-video rounded-xl bg-muted flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Vídeo indisponível</p>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="w-full aspect-video bg-muted animate-pulse rounded-xl" />}>
      <PandaPlayer
        videoId={videoId}
        lessonId={videoPlayerProps.lessonId}
        initialPosition={videoPlayerProps.initialPosition}
        durationSeconds={videoPlayerProps.durationSeconds}
        isCompleted={videoPlayerProps.isCompleted}
      />
    </Suspense>
  );
}

function DownloadBlock({ material }: { material?: LessonMaterial }) {
  if (!material) return null;
  return (
    <div className="rounded-xl border-2 border-[#6699F3]/25 bg-[#6699F3]/5 p-4 sm:p-5 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-[#6699F3]/15 flex items-center justify-center shrink-0">
        <Download className="w-6 h-6 text-[#6699F3]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-[#6699F3] uppercase tracking-wider mb-0.5">
          Material da aula
        </p>
        <p className="text-sm font-medium text-foreground truncate">{material.name}</p>
      </div>
      {material.signed_url ? (
        <a
          href={material.signed_url}
          download
          className="flex items-center gap-1.5 bg-[#6699F3] hover:bg-[#5580d4] active:bg-[#4a70c0] text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors shrink-0 min-h-[44px]"
        >
          <Download className="w-4 h-4" />
          <span>Baixar</span>
        </a>
      ) : (
        <span className="text-xs text-muted-foreground shrink-0 px-2">Indisponível</span>
      )}
    </div>
  );
}

const BLOCK_ICONS: Record<BlockType, React.ElementType> = {
  text: FileText,
  html: Code,
  embed: Globe,
  download: Download,
  video: FileText,
};

interface ContentBlocksProps {
  blocks: ContentBlock[];
  materials: LessonMaterial[];
  videoPlayerProps?: VideoPlayerProps;
}

export default function ContentBlocks({ blocks, materials, videoPlayerProps }: ContentBlocksProps) {
  const [materialsOpen, setMaterialsOpen] = useState(false);

  const materialById = Object.fromEntries(materials.map((m) => [m.id, m]));

  const referencedMaterialIds = new Set(
    blocks
      .filter((b) => b.type === "download")
      .map((b) => parseContent(b.content).material_id as string | undefined)
      .filter((id): id is string => Boolean(id))
  );
  const orphanMaterials = materials.filter((m) => !referencedMaterialIds.has(m.id));

  const hasContent = blocks.length > 0 || orphanMaterials.length > 0;
  if (!hasContent) return null;

  return (
    <div className="space-y-6 pt-4 border-t border-border">
      {blocks.map((block) => {
        const parsed = parseContent(block.content);

        return (
          <div key={block.id} className="space-y-2">
            {block.type === "video" && (
              <VideoBlock content={block.content} videoPlayerProps={videoPlayerProps} />
            )}

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

      {/* Materiais da aula — botão toggle (apenas desktop; mobile usa LessonBottomSheet) */}
      {orphanMaterials.length > 0 && (
        <div className="hidden lg:block">
          <button
            onClick={() => setMaterialsOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-border hover:border-[#6699F3]/50 bg-white hover:bg-[#6699F3]/5 transition-all text-sm font-medium text-foreground"
          >
            <span className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#6699F3]/10 flex items-center justify-center shrink-0">
                <Download className="w-4 h-4 text-[#6699F3]" />
              </div>
              <span>
                Materiais da aula
                <span className="ml-1.5 text-xs font-semibold text-[#6699F3] bg-[#6699F3]/10 px-1.5 py-0.5 rounded-full">
                  {orphanMaterials.length}
                </span>
              </span>
            </span>
            {materialsOpen
              ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
              : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            }
          </button>

          {materialsOpen && (
            <div className="mt-2 space-y-2">
              {orphanMaterials.map((m) => (
                <DownloadBlock key={m.id} material={m} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
