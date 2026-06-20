"use client";

import { useState, useTransition, useRef } from "react";
import { Upload, Trash2, Copy, Check } from "lucide-react";
import { uploadMaterial, deleteMaterial } from "./actions";

interface Material {
  id: string;
  name: string;
  file_path: string;
}

export default function AdminMaterialsUploader({
  lessonId,
  initialMaterials,
}: {
  lessonId: string;
  initialMaterials: Material[];
}) {
  const [materials, setMaterials] = useState<Material[]>(initialMaterials);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
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

      {/* Lista de materiais existentes */}
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
