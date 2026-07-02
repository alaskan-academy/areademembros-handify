"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Eye, EyeOff, X, Save, Upload, Loader2, Settings2, Check, GripVertical, BookOpen, FileText } from "lucide-react";
import { upsertShowcaseCourse, removeShowcaseCourse } from "@/app/(admin)/admin/vitrine/actions";
import {
  createCourse, updateCourse, togglePublished, deleteCourse,
  uploadCourseThumbnail, createCategory, updateCategory, deleteCategory,
  reorderCourses,
} from "./actions";
import { formatPrice } from "@/lib/format";
import Image from "next/image";

interface Category { id: string; name: string }
interface Forum { id: string; title: string; slug: string }
interface Course {
  id: string; title: string; slug: string; description: string | null;
  price: number | null; product_codes: string[]; workload_hours: number | null;
  course_type: "course" | "material"; is_subscription_only: boolean;
  has_certificate: boolean; published: boolean;
  category_id: string | null; forum_id: string | null; thumbnail_url: string | null;
  checkout_url: string | null; position: number;
  category: { name: string } | null;
  forum: { title: string; slug: string } | null;
  showcase: { sales_video_panda_id: string | null; position: number; active: boolean } | null;
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

// ─── Input de códigos Payt (multi-tag) ───────────────────────────────────────

function ProductCodesInput({ defaultCodes }: { defaultCodes?: string[] }) {
  const [codes, setCodes] = useState<string[]>(defaultCodes ?? []);
  const [inputVal, setInputVal] = useState("");

  function addCode(raw: string) {
    const trimmed = raw.trim().toUpperCase();
    if (!trimmed || codes.includes(trimmed)) { setInputVal(""); return; }
    setCodes((prev) => [...prev, trimmed]);
    setInputVal("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault();
      addCode(inputVal);
    }
    if (e.key === "Backspace" && !inputVal && codes.length) {
      setCodes((prev) => prev.slice(0, -1));
    }
  }

  function handleBlur() {
    if (inputVal.trim()) addCode(inputVal);
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">
        Cód. Payt
        <span className="text-muted-foreground/60 ml-1">(um ou mais — Enter ou vírgula para adicionar)</span>
      </label>
      {/* hidden: envia os códigos como CSV para o formData */}
      <input type="hidden" name="product_codes" value={codes.join(",")} />
      <div
        className="flex flex-wrap gap-1.5 min-h-[38px] w-full text-sm border border-border rounded-lg px-2.5 py-2 focus-within:ring-2 focus-within:ring-[#6699F3]/40 bg-background cursor-text"
        onClick={(e) => (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.focus()}
      >
        {codes.map((code) => (
          <span
            key={code}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#6699F3]/10 text-[#6699F3] text-xs font-mono font-medium"
          >
            {code}
            <button
              type="button"
              onClick={() => setCodes((prev) => prev.filter((c) => c !== code))}
              className="text-[#6699F3]/60 hover:text-[#6699F3] transition-colors leading-none"
              aria-label={`Remover ${code}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={codes.length === 0 ? "PROD_123" : ""}
          className="flex-1 min-w-[100px] bg-transparent outline-none text-sm font-mono placeholder:font-sans placeholder:text-muted-foreground/50"
        />
      </div>
    </div>
  );
}

// ─── Divisor de seção ────────────────────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 shrink-0">{label}</p>
      <div className="flex-1 h-px bg-border/50" />
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

  // Estado da vitrine — salva junto com o curso
  const [inVitrine, setInVitrine] = useState(initial?.showcase != null);
  const [salesVideo, setSalesVideo] = useState(initial?.showcase?.sales_video_panda_id ?? "");

  function slugify(v: string) {
    return v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!fd.get("is_subscription_only")) fd.set("is_subscription_only", "false");
    if (!fd.get("has_certificate")) fd.set("has_certificate", "false");
    if (!fd.get("published")) fd.set("published", "false");

    startTransition(async () => {
      const result = courseId
        ? await updateCourse(courseId, fd)
        : await createCourse(fd);
      if (result && "error" in result && result.error) { setError(result.error); return; }

      // Salva vitrine junto (só ao editar curso existente)
      if (courseId) {
        if (inVitrine) {
          const vfd = new FormData();
          vfd.set("course_id", courseId);
          vfd.set("sales_video_panda_id", salesVideo);
          vfd.set("checkout_url", (fd.get("checkout_url") as string) ?? "");
          vfd.set("position", String(initial?.showcase?.position ?? 0));
          vfd.set("active", "true");
          await upsertShowcaseCourse(vfd);
        } else if (initial?.showcase != null) {
          await removeShowcaseCourse(courseId);
        }
      }

      setError(null);
      onSave();
    });
  }

  const checkboxes = [
    {
      name: "is_subscription_only",
      label: "Apenas assinantes",
      desc: "Requer plano ativo para acessar",
      checked: initial?.is_subscription_only ?? false,
    },
    {
      name: "has_certificate",
      label: "Concede certificado",
      desc: "Emite certificado ao concluir",
      checked: initial?.has_certificate ?? false,
    },
    ...(courseId
      ? [{ name: "published", label: "Publicado", desc: "Visível para alunas", checked: initial?.published ?? false }]
      : []),
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      {/* ── Thumbnail ─── */}
      <ThumbnailUpload defaultUrl={initial?.thumbnail_url} />

      {/* ── Tipo de conteúdo ─── */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Tipo de conteúdo</label>
        <div className="flex gap-3">
          {(["course", "material"] as const).map((t) => (
            <label key={t} className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-border hover:border-[#6699F3]/50 transition-colors has-[:checked]:border-[#6699F3] has-[:checked]:bg-[#6699F3]/5">
              <input
                type="radio" name="course_type" value={t}
                defaultChecked={(initial?.course_type ?? "course") === t}
                className="accent-[#6699F3]"
              />
              <span className="text-sm font-medium">
                {t === "course" ? "Curso" : "Material Didático"}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* ── Identificação ─── */}
      <SectionDivider label="Identificação" />

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

      {/* ── Preço e acesso ─── */}
      <SectionDivider label="Preço e acesso" />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Preço (R$)</label>
          <input
            name="price" type="number" min="0" step="0.01" defaultValue={initial?.price ?? 0}
            className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 bg-background"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Carga horária (h)</label>
          <input
            name="workload_hours" type="number" min="0" defaultValue={initial?.workload_hours ?? 0}
            className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 bg-background"
          />
        </div>
      </div>

      <ProductCodesInput defaultCodes={initial?.product_codes ?? []} />

      {/* ── Vendas ─── */}
      <SectionDivider label="Vendas" />

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Link de checkout (Payt)</label>
        <input
          ref={checkoutUrlRef}
          name="checkout_url" type="url"
          defaultValue={initial?.checkout_url ?? ""}
          placeholder="https://pay.payt.com.br/..."
          className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 bg-background"
        />
      </div>

      {/* Vitrine — só exibe ao editar curso existente */}
      {courseId && (
        <div className="space-y-3">
          <label className="flex items-center gap-2.5 cursor-pointer select-none w-fit">
            <input
              type="checkbox"
              checked={inVitrine}
              onChange={(e) => setInVitrine(e.target.checked)}
              className="accent-[#6699F3] rounded"
            />
            <span className="text-sm font-medium">Exibir na vitrine</span>
            <span className="text-[11px] text-muted-foreground">(visível para quem ainda não comprou)</span>
          </label>

          {inVitrine && (
            <div className="space-y-1 pl-6">
              <label className="text-xs font-medium text-muted-foreground">
                ID do vídeo de vendas (Panda)
              </label>
              <input
                type="text"
                value={salesVideo}
                onChange={(e) => setSalesVideo(e.target.value)}
                placeholder="UUID ou URL do vídeo de apresentação"
                className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 bg-background"
              />
              <p className="text-[11px] text-muted-foreground">
                Vídeo exibido no modal da vitrine — diferente do vídeo da aula.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Organização ─── */}
      <SectionDivider label="Organização" />

      <CategorySelect categories={categories} defaultValue={initial?.category_id} />
      <ForumSelect forums={forums} defaultValue={initial?.forum_id} />

      {/* ── Opções ─── */}
      <SectionDivider label="Opções" />

      <div className={`grid gap-2 ${checkboxes.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
        {checkboxes.map(({ name, label, desc, checked }) => (
          <label
            key={name}
            className="flex items-start gap-3 p-3 rounded-xl border border-border/70 cursor-pointer hover:border-[#6699F3]/40 hover:bg-[#6699F3]/3 transition-colors has-[:checked]:border-[#6699F3]/50 has-[:checked]:bg-[#6699F3]/5"
          >
            <input
              name={name} type="checkbox" value="true"
              defaultChecked={checked}
              className="mt-0.5 accent-[#6699F3] shrink-0"
            />
            <div>
              <p className="text-sm font-medium leading-tight">{label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
            </div>
          </label>
        ))}
      </div>

      {/* ── Ações ─── */}
      <div className="flex gap-2 pt-2 border-t border-border/50">
        <button
          type="submit" disabled={isPending}
          className="flex items-center gap-1.5 text-sm px-5 py-2.5 rounded-lg bg-[#6699F3] text-white hover:bg-[#5580d4] transition-colors disabled:opacity-50 font-medium"
        >
          <Save className="w-4 h-4" />
          {isPending ? "Salvando..." : courseId ? "Salvar alterações" : "Criar curso"}
        </button>
        <button
          type="button" onClick={onCancel}
          className="text-sm px-4 py-2.5 rounded-lg border border-border hover:bg-muted transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

type DragGroup = "course" | "material";

function sortByPosition(items: Course[]) {
  return [...items].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

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

  // Listas separadas por tipo, ordenadas por position
  const [courseItems, setCourseItems] = useState<Course[]>(() =>
    sortByPosition(courses.filter((c) => c.course_type === "course"))
  );
  const [materialItems, setMaterialItems] = useState<Course[]>(() =>
    sortByPosition(courses.filter((c) => c.course_type === "material"))
  );
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  // Sincroniza quando a prop muda (após router.refresh)
  useEffect(() => {
    setCourseItems(sortByPosition(courses.filter((c) => c.course_type === "course")));
    setMaterialItems(sortByPosition(courses.filter((c) => c.course_type === "material")));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses]);

  // Drag-and-drop
  const dragFrom = useRef<{ idx: number; group: DragGroup } | null>(null);
  const [dragOver, setDragOver] = useState<{ idx: number; group: DragGroup } | null>(null);
  const [dragging, setDragging] = useState<{ idx: number; group: DragGroup } | null>(null);

  function getItems(group: DragGroup) { return group === "course" ? courseItems : materialItems; }
  function setItems(group: DragGroup, next: Course[]) {
    if (group === "course") setCourseItems(next); else setMaterialItems(next);
  }

  function handleDragStart(idx: number, group: DragGroup) {
    dragFrom.current = { idx, group };
    setDragging({ idx, group });
  }

  function handleDragOver(e: React.DragEvent, idx: number, group: DragGroup) {
    e.preventDefault();
    if (dragFrom.current?.group === group) setDragOver({ idx, group });
  }

  function handleDrop(e: React.DragEvent, toIdx: number, group: DragGroup) {
    e.preventDefault();
    const from = dragFrom.current;
    if (!from || from.group !== group) { cleanup(); return; }
    if (from.idx === toIdx) { cleanup(); return; }

    const items = getItems(group);
    const next = [...items];
    const [removed] = next.splice(from.idx, 1);
    next.splice(toIdx, 0, removed);
    setItems(group, next);
    cleanup();

    setIsSavingOrder(true);
    startTransition(async () => {
      await reorderCourses(next.map((c) => c.id));
      setIsSavingOrder(false);
    });
  }

  function cleanup() {
    dragFrom.current = null;
    setDragOver(null);
    setDragging(null);
  }

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

  function renderCourseRow(course: Course, idx: number, group: DragGroup) {
    const isDraggingThis = dragging?.group === group && dragging?.idx === idx;
    const isDropTarget = dragOver?.group === group && dragOver?.idx === idx;

    return (
      <div
        key={course.id}
        draggable={!editingId && !showCreate}
        onDragStart={() => handleDragStart(idx, group)}
        onDragOver={(e) => handleDragOver(e, idx, group)}
        onDrop={(e) => handleDrop(e, idx, group)}
        onDragEnd={cleanup}
        className={`handify-card overflow-hidden transition-all ${
          isDraggingThis ? "opacity-40 scale-[0.99]" : ""
        } ${isDropTarget ? "border-[#6699F3] shadow-md" : ""}`}
      >
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
          <div className="flex items-center gap-3 p-4">
            {/* Drag handle */}
            <div
              className="cursor-grab active:cursor-grabbing shrink-0 p-1 -ml-1 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
              title="Arrastar para reordenar"
            >
              <GripVertical className="w-4 h-4" />
            </div>

            {/* Thumbnail */}
            {course.thumbnail_url ? (
              <div className="relative w-16 h-10 rounded-lg overflow-hidden shrink-0 bg-muted">
                <Image src={course.thumbnail_url} alt={course.title} fill className="object-cover" unoptimized />
              </div>
            ) : (
              <div className="w-16 h-10 rounded-lg bg-muted shrink-0 flex items-center justify-center">
                <Upload className="w-3.5 h-3.5 text-muted-foreground/40" />
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
                {course.product_codes?.length > 0 && <span> · cod: {course.product_codes.join(", ")}</span>}
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
              <a href={`/admin/cursos/${course.id}`} className="text-xs text-[#6699F3] hover:underline px-2 hidden sm:block">
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
    );
  }

  const isEmpty = courseItems.length === 0 && materialItems.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Cursos</h1>
          {isSavingOrder && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Salvando ordem...
            </span>
          )}
        </div>
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

      {isEmpty && !showCreate ? (
        <div className="handify-card p-10 text-center text-muted-foreground text-sm">
          Nenhum curso. Clique em "Novo curso" para começar.
        </div>
      ) : (
        <div className="space-y-8">
          {/* ── Cursos ───────────────────────────── */}
          {courseItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#6699F3]" />
                <h2 className="text-sm font-semibold text-foreground">
                  Cursos
                  <span className="ml-1.5 text-muted-foreground font-normal">({courseItems.length})</span>
                </h2>
                <span className="text-[11px] text-muted-foreground/60 ml-1 hidden sm:inline">
                  — arraste para definir a ordem de exibição
                </span>
              </div>
              <div className="space-y-2">
                {courseItems.map((course, idx) => renderCourseRow(course, idx, "course"))}
              </div>
            </div>
          )}

          {/* ── Materiais Didáticos ───────────────── */}
          {materialItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-600" />
                <h2 className="text-sm font-semibold text-foreground">
                  Materiais Didáticos
                  <span className="ml-1.5 text-muted-foreground font-normal">({materialItems.length})</span>
                </h2>
                <span className="text-[11px] text-muted-foreground/60 ml-1 hidden sm:inline">
                  — arraste para definir a ordem de exibição
                </span>
              </div>
              <div className="space-y-2">
                {materialItems.map((course, idx) => renderCourseRow(course, idx, "material"))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
