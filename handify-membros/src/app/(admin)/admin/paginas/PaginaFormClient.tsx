"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Trash2, Eye, EyeOff } from "lucide-react";
import { savePage, deletePage } from "./actions";

interface Props {
  id: string | null;
  initialTitle?: string;
  initialSlug?: string;
  initialContent?: string;
  initialPublished?: boolean;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export default function PaginaFormClient({
  id,
  initialTitle = "",
  initialSlug = "",
  initialContent = "",
  initialPublished = false,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [title, setTitle] = useState(initialTitle);
  const [slug, setSlug] = useState(initialSlug);
  const [content, setContent] = useState(initialContent);
  const [published, setPublished] = useState(initialPublished);
  const [slugManual, setSlugManual] = useState(!!initialSlug);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  function handleTitleChange(v: string) {
    setTitle(v);
    if (!slugManual) setSlug(slugify(v));
  }

  function handleSave() {
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.set("title", title);
    fd.set("slug", slug);
    fd.set("content", content);
    fd.set("published", String(published));

    startTransition(async () => {
      const result = await savePage(id, fd);
      setSaving(false);
      if (result.error) { setError(result.error); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      if (!id) router.push("/admin/paginas");
    });
  }

  function handleDelete() {
    if (!id) return;
    if (!confirm("Deletar esta página permanentemente?")) return;
    startTransition(async () => {
      await deletePage(id);
      router.push("/admin/paginas");
    });
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Campos principais */}
      <div className="bg-white rounded-xl border border-border/60 shadow-sm divide-y divide-border/40">

        {/* Título */}
        <div className="px-5 py-4 space-y-1.5">
          <label className="block text-xs font-semibold text-foreground/60 uppercase tracking-wide">
            Título da página
          </label>
          <input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Ex: Termos de Uso"
            maxLength={200}
            className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30 font-medium"
          />
        </div>

        {/* Slug */}
        <div className="px-5 py-4 space-y-1.5">
          <label className="block text-xs font-semibold text-foreground/60 uppercase tracking-wide">
            Slug (URL)
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-foreground/40 whitespace-nowrap shrink-0">/p/</span>
            <input
              value={slug}
              onChange={(e) => { setSlug(slugify(e.target.value)); setSlugManual(true); }}
              placeholder="termos-de-uso"
              maxLength={100}
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30 font-mono"
            />
          </div>
          {slug && (
            <p className="text-[11px] text-muted-foreground">
              Acesso público em: <span className="font-mono">/p/{slug}</span>
            </p>
          )}
        </div>

        {/* Publicado */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Publicada</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {published ? "Visível publicamente em /p/" + slug : "Rascunho — invisível ao público"}
            </p>
          </div>
          <button
            onClick={() => setPublished((v) => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors ${published ? "bg-[#6699F3]" : "bg-muted-foreground/30"}`}
            aria-label={published ? "Despublicar" : "Publicar"}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${published ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>
      </div>

      {/* Conteúdo HTML */}
      <div className="bg-white rounded-xl border border-border/60 shadow-sm">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/40">
          <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">
            Conteúdo (HTML)
          </p>
          <button
            onClick={() => setPreview((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-foreground/50 hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-muted"
          >
            {preview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {preview ? "Editor" : "Visualizar"}
          </button>
        </div>

        {preview ? (
          <div
            className="px-8 py-6 prose prose-sm max-w-none min-h-[400px]"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="<h2>Título</h2><p>Conteúdo da página...</p>"
            rows={28}
            className="w-full px-5 py-4 text-sm font-mono resize-y focus:outline-none rounded-b-xl border-0 bg-transparent text-foreground/80 leading-relaxed min-h-[400px]"
          />
        )}
      </div>

      {/* Ações */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !title || !slug}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#6699F3] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <Check className="w-4 h-4" />
          ) : null}
          {saved ? "Salvo!" : saving ? "Salvando…" : "Salvar página"}
        </button>

        {id && (
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-200 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Deletar
          </button>
        )}

        <button
          onClick={() => router.push("/admin/paginas")}
          className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
