"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Eye, EyeOff, X, Save, Upload, Loader2, Settings2, Check } from "lucide-react";
import {
  createCourse, updateCourse, togglePublished, deleteCourse,
  uploadCourseThumbnail, createCategory, updateCategory, deleteCategory,
} from "./actions";
import { formatPrice } from "@/lib/format";
import Image from "next/image";

interface Category { id: string; name: string }
interface Forum { id: string; title: string; slug: string }
interface Course {
  id: string; title: string; slug: string; description: string | null;
  price: number | null; product_code: string | null; workload_hours: number | null;
  is_subscription_only: boolean; has_certificate: boolean; published: boolean;
  category_id: string | null; forum_id: string | null; thumbnail_url: string | null;
  category: { name: string } | null;
  forum: { title: string; slug: string } | null;
}

// ─── Seletor de categoria com criação inline ──────────────────────────────────

function CategorySelect({
  categories: initialCategories,
  defaultValue,
}: {
  categories: Category[];
  defaultValue?: string | null;
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [showManager, setShowManager] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCreate() {
    if (!newName.trim()) return;
    startTransition(async () => {
      const result = await createCategory(newName);
      if (result.error) { setError(result.error); return; }
      setCategories((prev) => [...prev, { id: result.id!, name: result.name! }]);
      setNewName("");
      setError(null);
    });
  }

  function handleUpdate(id: string) {
    if (!editingName.trim()) return;
    startTransition(async () => {
      const result = await updateCategory(id, editingName);
      if (result.error) { setError(result.error); return; }
      setCategories((prev) => prev.map((c) => c.id === id ? { ...c, name: editingName.trim() } : c));
      setEditingId(null);
      setError(null);
    });
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Excluir a categoria "${name}"? Cursos vinculados perderão a categoria.`)) return;
    startTransition(async () => {
      const result = await deleteCategory(id);
      if (result.error) { setError(result.error); return; }
      setCategories((prev) => prev.filter((c) => c.id !== id));
      setError(null);
    });
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">Categoria</label>
        <button
          type="button"
          onClick={() => setShowManager((v) => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Settings2 className="w-3 h-3" />
          Gerenciar categorias
        </button>
      </div>

      <select
        name="category_id"
        defaultValue={defaultValue ?? ""}
        className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40"
      >
        <option value="">— Nenhuma —</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      {showManager && (
        <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
          {error && <p className="text-xs text-red-600">{error}</p>}

          {/* Lista de categorias existentes */}
          <div className="space-y-1">
            {categories.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">Nenhuma categoria.</p>
            )}
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-2">
                {editingId === cat.id ? (
                  <>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); handleUpdate(cat.id); }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      autoFocus
                      className="flex-1 text-sm border border-[#6699F3] rounded-lg px-2.5 py-1 focus:outline-none bg-background"
                    />
                    <button
                      type="button"
                      onClick={() => handleUpdate(cat.id)}
                      disabled={isPending}
                      className="p-1.5 rounded-lg bg-[#6699F3] text-white hover:bg-[#5580d4] transition-colors disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm px-2.5 py-1 rounded-lg bg-background border border-border truncate">
                      {cat.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setEditingId(cat.id); setEditingName(cat.name); }}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0"
                    >
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(cat.id, cat.name)}
                      disabled={isPending}
                      className="p-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Nova categoria */}
          <div className="flex gap-2 pt-1 border-t border-border/50">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nova categoria..."
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleCreate())}
              className="flex-1 text-sm border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 bg-background"
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={isPending || !newName.trim()}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-[#6699F3] text-white hover:bg-[#5580d4] transition-colors disabled:opacity-50 shrink-0"
            >
              {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Criar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Seletor de fórum ────────────────────────────────────────────────────────

function ForumSelect({
  forums,
  defaultValue,
}: {
  forums: Forum[];
  defaultValue?: string | null;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">Fórum vinculado</label>
        <a href="/admin/forums" target="_blank" className="text-xs text-[#6699F3] hover:underline">
          Gerenciar fóruns →
        </a>
      </div>
      <select
        name="forum_id"
        defaultValue={defaultValue ?? ""}
        className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40"
      >
        <option value="">— Nenhum —</option>
        {forums.map((f) => (
          <option key={f.id} value={f.id}>{f.title}</option>
        ))}
      </select>
      <p className="text-[11px] text-muted-foreground">
        Alunas matriculadas neste curso poderão acessar o fórum selecionado.
      </p>
    </div>
  );
}

// ─── Upload de thumbnail ──────────────────────────────────────────────────────

function ThumbnailUpload({ defaultUrl }: { defaultUrl?: string | null }) {
  const [preview, setPreview] = useState<string | null>(defaultUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(defaultUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    setPreview(URL.createObjectURL(file));
    try {
      const fd = new FormData();
      fd.set("file", file);
      const result = await uploadCourseThumbnail(fd);
      if (result.error) {
        setError(result.error);
        setPreview(uploadedUrl);
      } else {
        setUploadedUrl(result.url!);
      }
    } catch {
      setError("Erro ao fazer upload. Verifique sua conexão e tente novamente.");
      setPreview(uploadedUrl);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">
        Thumbnail <span className="text-muted-foreground/60">(recomendado: 1280×720px · JPG, PNG ou WebP · max 10MB)</span>
      </label>
      <input name="thumbnail_url" type="hidden" value={uploadedUrl ?? ""} readOnly />

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        className="relative cursor-pointer rounded-xl border-2 border-dashed border-border hover:border-[#6699F3] transition-colors overflow-hidden bg-muted/30"
        style={{ aspectRatio: "16/9", maxHeight: 180 }}
      >
        {preview ? (
          <Image src={preview} alt="Thumbnail" fill className="object-cover" unoptimized />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
            <Upload className="w-6 h-6" />
            <span className="text-xs">Clique ou arraste a imagem</span>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ─── Formulário de curso ──────────────────────────────────────────────────────

function CourseForm({
  categories, forums, initial, onSave, onCancel, courseId,
}: {
  categories: Category[];
  forums: Forum[];
  initial?: Partial<Course>;
  onSave: () => void;
  onCancel: () => void;
  courseId?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function slugify(v: string) {
    return v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // Checkbox nao marcado nao envia valor — forcar false
    if (!fd.get("is_subscription_only")) fd.set("is_subscription_only", "false");
    if (!fd.get("has_certificate")) fd.set("has_certificate", "false");
    if (!fd.get("published")) fd.set("published", "false");

    startTransition(async () => {
      const result = courseId
        ? await updateCourse(courseId, fd)
        : await createCourse(fd);
      if (result && "error" in result && result.error) { setError(result.error); return; }
      setError(null);
      onSave();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <ThumbnailUpload defaultUrl={initial?.thumbnail_url} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Título *</label>
          <input
            name="title" required defaultValue={initial?.title ?? ""}
            placeholder="Ex: Crochê do Básico ao Avançado"
            onChange={(e) => {
              if (!courseId) {
                const slugInput = e.currentTarget.form?.querySelector<HTMLInputElement>('[name="slug"]');
                if (slugInput) slugInput.value = slugify(e.target.value);
              }
            }}
            className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 bg-background"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Slug * (URL)</label>
          <input
            name="slug" required defaultValue={initial?.slug ?? ""}
            placeholder="croche-basico-ao-avancado"
            className="w-full text-sm border border-border rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 bg-background"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Descrição</label>
        <textarea
          name="description" rows={3} defaultValue={initial?.description ?? ""}
          placeholder="Descrição do curso..."
          className="w-full text-sm border border-border rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 bg-background"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Preço (R$)</label>
          <input
            name="price" type="number" min="0" step="0.01" defaultValue={initial?.price ?? 0}
            className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 bg-background"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Carga (h)</label>
          <input
            name="workload_hours" type="number" min="0" defaultValue={initial?.workload_hours ?? 0}
            className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 bg-background"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Cód. Payt</label>
          <input
            name="product_code" defaultValue={initial?.product_code ?? ""} placeholder="PROD_123"
            className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 bg-background"
          />
        </div>
      </div>

      <CategorySelect categories={categories} defaultValue={initial?.category_id} />
      <ForumSelect forums={forums} defaultValue={initial?.forum_id} />

      <div className="flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            name="is_subscription_only" type="checkbox" value="true"
            defaultChecked={initial?.is_subscription_only ?? false}
            className="rounded"
          />
          <span className="text-sm">Apenas assinantes</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            name="has_certificate" type="checkbox" value="true"
            defaultChecked={initial?.has_certificate ?? false}
            className="rounded"
          />
          <span className="text-sm">Concede certificado</span>
        </label>
        {courseId && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              name="published" type="checkbox" value="true"
              defaultChecked={initial?.published ?? false}
              className="rounded"
            />
            <span className="text-sm">Publicado</span>
          </label>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="submit" disabled={isPending}
          className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-[#6699F3] text-white hover:bg-[#5580d4] transition-colors disabled:opacity-50 font-medium"
        >
          <Save className="w-4 h-4" />
          {isPending ? "Salvando..." : courseId ? "Salvar alterações" : "Criar curso"}
        </button>
        <button
          type="button" onClick={onCancel}
          className="text-sm px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function CourseManager({
  courses,
  categories,
  forums,
}: {
  courses: Course[];
  categories: Category[];
  forums: Forum[];
}) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleToggle(courseId: string, current: boolean) {
    startTransition(async () => {
      await togglePublished(courseId, !current);
      router.refresh();
    });
  }

  function handleDelete(courseId: string, title: string) {
    if (!confirm(`Excluir o curso "${title}"? Esta ação é irreversível.`)) return;
    startTransition(async () => {
      await deleteCourse(courseId);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cursos</h1>
        <button
          onClick={() => { setShowCreate(true); setEditingId(null); }}
          className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-[#6699F3] text-white hover:bg-[#5580d4] transition-colors font-medium"
        >
          <Plus className="w-4 h-4" /> Novo curso
        </button>
      </div>

      {showCreate && (
        <div className="handify-card p-5 border-[#6699F3]/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Novo curso</h2>
            <button onClick={() => setShowCreate(false)} className="p-1 rounded hover:bg-muted transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <CourseForm
            categories={categories}
            forums={forums}
            onSave={() => { setShowCreate(false); router.refresh(); }}
            onCancel={() => setShowCreate(false)}
          />
        </div>
      )}

      {courses.length === 0 && !showCreate ? (
        <div className="handify-card p-10 text-center text-muted-foreground text-sm">
          Nenhum curso. Clique em "Novo curso" para começar.
        </div>
      ) : (
        <div className="space-y-3">
          {courses.map((course) => (
            <div key={course.id} className="handify-card overflow-hidden">
              {editingId === course.id ? (
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold">Editando: {course.title}</h2>
                    <button onClick={() => setEditingId(null)} className="p-1 rounded hover:bg-muted transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <CourseForm
                    categories={categories}
                    forums={forums}
                    initial={course}
                    courseId={course.id}
                    onSave={() => { setEditingId(null); router.refresh(); }}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-4 p-4">
                  {/* Thumbnail */}
                  {course.thumbnail_url ? (
                    <div className="relative w-20 h-12 rounded-lg overflow-hidden shrink-0 bg-muted">
                      <Image src={course.thumbnail_url} alt={course.title} fill className="object-cover" unoptimized />
                    </div>
                  ) : (
                    <div className="w-20 h-12 rounded-lg bg-muted shrink-0 flex items-center justify-center">
                      <Upload className="w-4 h-4 text-muted-foreground/40" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{course.title}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${course.published ? "bg-[#72CF92]/20 text-[#72CF92]" : "bg-muted text-muted-foreground"}`}>
                        {course.published ? "Publicado" : "Rascunho"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {course.category?.name && <span>{course.category.name} · </span>}
                      {formatPrice(course.price ?? 0)} · {course.workload_hours ?? 0}h
                      {course.product_code && <span> · cod: {course.product_code}</span>}
                      {course.forum?.title && <span className="text-[#6699F3]"> · fórum: {course.forum.title}</span>}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleToggle(course.id, course.published)}
                      disabled={isPending}
                      title={course.published ? "Arquivar" : "Publicar"}
                      className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      {course.published
                        ? <EyeOff className="w-4 h-4 text-muted-foreground" />
                        : <Eye className="w-4 h-4 text-[#6699F3]" />}
                    </button>
                    <button
                      onClick={() => { setEditingId(course.id); setShowCreate(false); }}
                      className="p-2 rounded-lg hover:bg-muted transition-colors"
                    >
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <a href={`/admin/cursos/${course.id}`} className="text-xs text-[#6699F3] hover:underline px-2">
                      Módulos →
                    </a>
                    <button
                      onClick={() => handleDelete(course.id, course.title)}
                      disabled={isPending}
                      className="p-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
