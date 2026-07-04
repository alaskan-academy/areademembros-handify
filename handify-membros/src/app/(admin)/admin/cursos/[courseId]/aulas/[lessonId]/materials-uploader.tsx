"use client";

import { useState, useTransition, useRef } from "react";
import { Upload, Trash2, Copy, Check, Link2, ChevronDown, ChevronUp, Search } from "lucide-react";
import { uploadMaterial, deleteMaterial, linkMaterial } from "./actions";

interface Material {
  id: string;
  name: string;
  file_path: string;
}

interface AllMaterial {
  id: string;
  name: string;
  file_path: string;
  lesson_id: string;
  lesson_title: string;
  course_title: string;
}

export default function AdminMaterialsUploader({
  lessonId,
  initialMaterials,
  allMaterials = [],
}: {
  lessonId: string;
  initialMaterials: Material[];
  allMaterials?: AllMaterial[];
}) {
  const [materials, setMaterials] = useState<Material[]>(initialMaterials);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [linkOpen, setLinkOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    data.set("lessonId", lessonId);

    startTransition(async () => {
      try {
        await uploadMaterial(data);
        form.reset();
        setError(null);
        window.location.reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro no upload");
      }
    });
  }

  function handleDelete(materialId: string, name: string) {
    if (!confirm(`Deletar "${name}"?`)) return;
    startTransition(async () => {
      try {
        await deleteMaterial(materialId);
        setMaterials((prev) => prev.filter((m) => m.id !== materialId));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao deletar");
      }
    });
  }

  function copyId(id: string) {
    navigator.clipboard.writeText(id).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  function handleLink(m: AllMaterial) {
    startTransition(async () => {
      try {
        await linkMaterial({ lessonId, name: m.name, filePath: m.file_path });
        setLinkedIds((prev) => new Set(prev).add(m.id));
        setError(null);
        window.location.reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao vincular");
      }
    });
  }

  const filteredAll = allMaterials.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.lesson_title.toLowerCase().includes(q) ||
      m.course_title.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <h2 className="font-semibold">Materiais da Aula</h2>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      {/* Upload form */}
      <form onSubmit={handleUpload} className="handify-card p-4 space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Novo material</p>
        <input
          ref={nameRef}
          name="name"
          type="text"
          required
          placeholder="Nome do material (ex: Apostila aula 01)"
          className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 bg-background"
        />
        <input
          ref={fileRef}
          name="file"
          type="file"
          required
          accept=".pdf,.zip,.png,.jpg,.jpeg,.webp,.mp4,.mp3,.doc,.docx,.ppt,.pptx"
          className="w-full text-sm text-muted-foreground file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#6699F3]/10 file:text-[#6699F3] hover:file:bg-[#6699F3]/20 cursor-pointer"
        />
        <p className="text-[11px] text-muted-foreground">
          Formatos aceitos: PDF, ZIP, PNG, JPG, MP4, MP3, DOC, PPT · Máx 50MB
        </p>
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#6699F3] text-white hover:bg-[#5580d4] transition-colors disabled:opacity-50"
        >
          <Upload className="w-3 h-3" />
          {isPending ? "Enviando..." : "Enviar material"}
        </button>
      </form>

      {/* Vincular material de outra aula */}
      {allMaterials.length > 0 && (
        <div className="handify-card overflow-hidden">
          <button
            onClick={() => setLinkOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5" />
              Vincular material de outra aula
            </span>
            {linkOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {linkOpen && (
            <div className="border-t border-border px-4 pb-4 space-y-3 pt-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar por nome, aula ou curso..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full text-sm pl-8 pr-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 bg-background"
                />
              </div>

              {filteredAll.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Nenhum material encontrado.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {filteredAll.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{m.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {m.course_title} · {m.lesson_title}
                        </p>
                      </div>
                      <button
                        onClick={() => handleLink(m)}
                        disabled={isPending || linkedIds.has(m.id)}
                        className="shrink-0 flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-[#6699F3]/10 text-[#6699F3] hover:bg-[#6699F3]/20 transition-colors disabled:opacity-50"
                      >
                        {linkedIds.has(m.id) ? (
                          <><Check className="w-3 h-3" /> Vinculado</>
                        ) : (
                          <><Link2 className="w-3 h-3" /> Vincular</>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Lista de materiais desta aula */}
      {materials.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum material enviado ainda.
        </p>
      ) : (
        <div className="space-y-2">
          {materials.map((m) => (
            <div
              key={m.id}
              className="handify-card p-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{m.name}</p>
                <p className="text-[10px] text-muted-foreground font-mono truncate">
                  ID: {m.id}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => copyId(m.id)}
                  title="Copiar ID para usar em bloco Download"
                  className="p-1.5 rounded hover:bg-muted transition-colors"
                >
                  {copiedId === m.id ? (
                    <Check className="w-3.5 h-3.5 text-[#72CF92]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </button>
                <button
                  onClick={() => handleDelete(m.id, m.name)}
                  disabled={isPending}
                  className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
