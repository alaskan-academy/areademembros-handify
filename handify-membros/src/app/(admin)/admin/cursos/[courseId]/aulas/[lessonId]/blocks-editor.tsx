"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { Plus, Trash2, ChevronUp, ChevronDown, Save, Info, Video } from "lucide-react";
import { upsertBlock, deleteBlock, reorderBlocks } from "./actions";

const RichTextEditor = dynamic(
  () => import("@/components/editor/rich-text-editor"),
  { ssr: false, loading: () => <div className="h-40 bg-muted animate-pulse rounded-lg" /> }
);

type BlockType = "text" | "html" | "embed" | "download" | "video";

interface Block {
  id: string;
  type: BlockType;
  content: string;
  position: number;
}

function parseContent(content: string): Record<string, unknown> {
  try {
    return JSON.parse(content);
  } catch {
    return { body: content };
  }
}

// Resumo legível do conteúdo de cada bloco para o preview
function blockSummary(block: Block): string {
  const parsed = parseContent(block.content);
  switch (block.type) {
    case "text":
    case "html": {
      const raw =
        (parsed.html as string) ?? (parsed.body as string) ?? "";
      return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
    }
    case "embed":
      return (parsed.url as string) ?? "(sem URL)";
    case "download":
      return `Material: ${(parsed.material_id as string) ?? "(sem ID)"}`;
    case "video":
      return `Vídeo: ${(parsed.video_panda_id as string) ?? "(sem ID)"}`;
    default:
      return "";
  }
}

function ContentInput({
  type,
  value,
  onChange,
}: {
  type: BlockType;
  value: string;
  onChange: (v: string) => void;
}) {
  const parsed = parseContent(value);

  if (type === "text") {
    // Bloco de texto rico — armazena {"html": "<p>...</p>"}
    const htmlValue = (parsed.html as string) ?? (parsed.body as string) ?? "";
    return (
      <RichTextEditor
        value={htmlValue}
        onChange={(html) => onChange(JSON.stringify({ html }))}
        placeholder="Digite o conteúdo da aula..."
      />
    );
  }

  if (type === "html") {
    const rawHtml = (parsed.html as string) ?? (parsed.body as string) ?? "";
    const isFullDoc = /^\s*(<!DOCTYPE|<html)/i.test(rawHtml);

    return (
      <div className="space-y-2">
        {isFullDoc ? (
          <div className="flex items-start gap-2 text-xs text-[#6699F3] bg-[#6699F3]/8 px-3 py-2 rounded-lg border border-[#6699F3]/20">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              HTML completo detectado — exibido em iframe que se expande automaticamente ao tamanho do conteúdo.
            </span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Escreva HTML diretamente. Para página completa com CSS/JS próprio, comece com{" "}
            <code className="bg-muted px-1 rounded">{"<!DOCTYPE html>"}</code>.
          </p>
        )}
        <textarea
          rows={10}
          className="w-full text-xs border border-border rounded-lg px-3 py-2 font-mono resize-y focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 bg-background"
          placeholder="<p>Conteúdo HTML aqui...</p>"
          value={rawHtml}
          onChange={(e) => onChange(JSON.stringify({ html: e.target.value }))}
        />
      </div>
    );
  }

  if (type === "embed") {
    return (
      <div className="space-y-2">
        <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Use para Google Forms, Typeform, YouTube, Notion, Canva.
            Sites como Shopee bloqueiam incorporação — para esses, use o bloco <strong>HTML</strong> com código completo.
          </span>
        </div>
        <input
          type="url"
          className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 bg-background"
          placeholder="https://docs.google.com/forms/..."
          value={(parsed.url as string) ?? ""}
          onChange={(e) =>
            onChange(JSON.stringify({ ...parsed, url: e.target.value }))
          }
        />
        <input
          type="text"
          className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 bg-background"
          placeholder="Título (opcional)"
          value={(parsed.title as string) ?? ""}
          onChange={(e) =>
            onChange(JSON.stringify({ ...parsed, title: e.target.value }))
          }
        />
        <input
          type="number"
          className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 bg-background"
          placeholder="Altura em px (ex: 600)"
          value={(parsed.height as number) ?? ""}
          onChange={(e) =>
            onChange(
              JSON.stringify({
                ...parsed,
                height: e.target.value ? Number(e.target.value) : undefined,
              })
            )
          }
        />
      </div>
    );
  }

  if (type === "download") {
    return (
      <input
        type="text"
        className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 bg-background"
        placeholder="ID do material (copie da seção Materiais abaixo)"
        value={(parsed.material_id as string) ?? ""}
        onChange={(e) =>
          onChange(JSON.stringify({ material_id: e.target.value }))
        }
      />
    );
  }

  if (type === "video") {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Cole o ID do vídeo do Panda Video (UUID) ou a URL completa do player.
        </p>
        <input
          type="text"
          className="w-full text-sm border border-border rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 bg-background"
          placeholder="abc123xyz... ou https://player.pandavideo.com.br/embed/?v=..."
          value={(parsed.video_panda_id as string) ?? ""}
          onChange={(e) =>
            onChange(JSON.stringify({ video_panda_id: e.target.value }))
          }
        />
      </div>
    );
  }

  return null;
}

const BLOCK_LABELS: Record<BlockType, string> = {
  text: "Texto",
  html: "HTML",
  embed: "Embed",
  download: "Download",
  video: "Vídeo",
};

export default function AdminBlocksEditor({
  lessonId,
  initialBlocks,
}: {
  lessonId: string;
  initialBlocks: Block[];
}) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editType, setEditType] = useState<BlockType>("text");
  const [addingType, setAddingType] = useState<BlockType | null>(null);
  const [newContent, setNewContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function startEdit(block: Block) {
    setEditingId(block.id);
    setEditContent(block.content);
    setEditType(block.type);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setError(null);
  }

  function handleSaveEdit(block: Block) {
    startTransition(async () => {
      try {
        const updated = await upsertBlock(lessonId, block.id, {
          type: editType,
          content: editContent,
          position: block.position,
        });
        setBlocks((prev) =>
          prev.map((b) => (b.id === block.id ? { ...b, ...updated } : b))
        );
        setEditingId(null);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao salvar");
      }
    });
  }

  function handleAdd() {
    if (!addingType) return;
    // Para HTML, conteúdo mínimo para passar validação min(1)
    const content = newContent || (addingType === "html" ? JSON.stringify({ html: "" }) : "");
    const emptyValues = [
      JSON.stringify({ body: "" }),
      JSON.stringify({ html: "" }),
      JSON.stringify({ url: "" }),
      JSON.stringify({ video_panda_id: "" }),
    ];
    if (!content || emptyValues.includes(content)) {
      setError("Preencha o conteúdo antes de salvar.");
      return;
    }
    startTransition(async () => {
      try {
        const created = await upsertBlock(lessonId, null, {
          type: addingType,
          content,
          position: blocks.length,
        });
        setBlocks((prev) => [...prev, created as Block]);
        setAddingType(null);
        setNewContent("");
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao criar bloco");
      }
    });
  }

  function handleDelete(blockId: string) {
    if (!confirm("Deletar este bloco?")) return;
    startTransition(async () => {
      try {
        await deleteBlock(blockId);
        setBlocks((prev) => prev.filter((b) => b.id !== blockId));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao deletar");
      }
    });
  }

  function handleMove(index: number, direction: "up" | "down") {
    const newBlocks = [...blocks];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newBlocks.length) return;

    [newBlocks[index], newBlocks[swapIndex]] = [
      newBlocks[swapIndex],
      newBlocks[index],
    ];
    const updated = newBlocks.map((b, i) => ({ ...b, position: i }));
    setBlocks(updated);

    startTransition(async () => {
      try {
        await reorderBlocks(updated.map(({ id, position }) => ({ id, position })));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao reordenar");
      }
    });
  }

  function openAddForm(type: BlockType) {
    // Se já há um form aberto do mesmo tipo, fecha; senão abre o novo
    if (addingType === type) {
      setAddingType(null);
      return;
    }
    setAddingType(type);
    setNewContent("");
    setError(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold">Blocos de Conteúdo</h2>
        <div className="flex flex-wrap gap-2">
          {(["video", "text", "html", "embed", "download"] as BlockType[]).map((t) => (
            <button
              key={t}
              onClick={() => openAddForm(t)}
              className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors
                ${addingType === t
                  ? "bg-[#6699F3] border-[#6699F3] text-white"
                  : "border-[#6699F3] text-[#6699F3] hover:bg-[#6699F3]/10"
                }`}
            >
              <Plus className="w-3 h-3" />
              {BLOCK_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Adicione quantos blocos quiser — clique no tipo de bloco acima para abrir o formulário de adição.
      </p>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      {/* Form: novo bloco */}
      {addingType && (
        <div className="handify-card p-4 space-y-3 border-[#6699F3]/40 bg-[#6699F3]/[0.03]">
          <p className="text-sm font-semibold">
            Novo bloco: {BLOCK_LABELS[addingType]}
          </p>
          <ContentInput
            type={addingType}
            value={newContent}
            onChange={setNewContent}
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={isPending}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#6699F3] text-white hover:bg-[#5580d4] transition-colors disabled:opacity-50"
            >
              <Save className="w-3 h-3" />
              {isPending ? "Salvando…" : "Salvar bloco"}
            </button>
            <button
              onClick={() => setAddingType(null)}
              className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista de blocos existentes */}
      {blocks.length === 0 && !addingType ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nenhum bloco ainda. Use os botões acima para adicionar.
        </p>
      ) : (
        <div className="space-y-2">
          {blocks.map((block, index) => (
            <div key={block.id} className="handify-card p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    {BLOCK_LABELS[block.type]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    #{index + 1}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleMove(index, "up")}
                    disabled={index === 0 || isPending}
                    className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleMove(index, "down")}
                    disabled={index === blocks.length - 1 || isPending}
                    className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() =>
                      editingId === block.id ? cancelEdit() : startEdit(block)
                    }
                    className="text-xs px-2.5 py-1 rounded border border-border hover:bg-muted transition-colors"
                  >
                    {editingId === block.id ? "Cancelar" : "Editar"}
                  </button>
                  <button
                    onClick={() => handleDelete(block.id)}
                    disabled={isPending}
                    className="p-1 rounded hover:bg-red-50 text-red-500 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {editingId === block.id ? (
                <div className="space-y-2">
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as BlockType)}
                    className="text-sm border border-border rounded-lg px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40"
                  >
                    {(["video", "text", "html", "embed", "download"] as BlockType[]).map(
                      (t) => (
                        <option key={t} value={t}>
                          {BLOCK_LABELS[t]}
                        </option>
                      )
                    )}
                  </select>
                  <ContentInput
                    type={editType}
                    value={editContent}
                    onChange={setEditContent}
                  />
                  <button
                    onClick={() => handleSaveEdit(block)}
                    disabled={isPending}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#6699F3] text-white hover:bg-[#5580d4] transition-colors disabled:opacity-50"
                  >
                    <Save className="w-3 h-3" />
                    {isPending ? "Salvando…" : "Salvar"}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground line-clamp-2 break-all italic">
                  {blockSummary(block) || <span className="opacity-50">(vazio)</span>}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
