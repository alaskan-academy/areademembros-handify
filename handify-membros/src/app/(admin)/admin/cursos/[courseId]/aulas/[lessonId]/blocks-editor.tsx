"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Save } from "lucide-react";
import { upsertBlock, deleteBlock, reorderBlocks } from "./actions";

type BlockType = "text" | "html" | "embed" | "download";

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
    return (
      <textarea
        rows={4}
        className="w-full text-sm border border-border rounded-lg px-3 py-2 font-mono resize-y focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 bg-background"
        placeholder="Texto simples da aula..."
        value={(parsed.body as string) ?? value}
        onChange={(e) => onChange(JSON.stringify({ body: e.target.value }))}
      />
    );
  }

  if (type === "html") {
    return (
      <textarea
        rows={6}
        className="w-full text-xs border border-border rounded-lg px-3 py-2 font-mono resize-y focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 bg-background"
        placeholder="<p>HTML personalizado...</p>"
        value={(parsed.html as string) ?? ""}
        onChange={(e) => onChange(JSON.stringify({ html: e.target.value }))}
      />
    );
  }

  if (type === "embed") {
    return (
      <div className="space-y-2">
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

  return null;
}

const BLOCK_LABELS: Record<BlockType, string> = {
  text: "Texto",
  html: "HTML",
  embed: "Embed",
  download: "Download",
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
        await upsertBlock(lessonId, block.id, {
          type: editType,
          content: editContent,
          position: block.position,
        });
        setBlocks((prev) =>
          prev.map((b) =>
            b.id === block.id
              ? { ...b, type: editType, content: editContent }
              : b
          )
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
    startTransition(async () => {
      try {
        await upsertBlock(lessonId, null, {
          type: addingType,
          content: newContent,
          position: blocks.length,
        });
        // Reload will happen via revalidatePath; for now optimistic add
        setAddingType(null);
        setNewContent("");
        setError(null);
        // Reload blocks
        window.location.reload();
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Blocos de Conteúdo</h2>
        <div className="flex gap-2">
          {(["text", "html", "embed", "download"] as BlockType[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setAddingType(t);
                setNewContent("");
                setError(null);
              }}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-[#6699F3] text-[#6699F3] hover:bg-[#6699F3]/10 transition-colors"
            >
              <Plus className="w-3 h-3" />
              {BLOCK_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      {/* Form: novo bloco */}
      {addingType && (
        <div className="handify-card p-4 space-y-3 border-[#6699F3]/40">
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
              Salvar
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
          Nenhum bloco ainda. Adicione um acima.
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
                    {(["text", "html", "embed", "download"] as BlockType[]).map(
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
                    Salvar
                  </button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground font-mono line-clamp-2 break-all">
                  {block.content}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
