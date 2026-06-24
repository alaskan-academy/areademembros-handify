"use client";

import { useState, useTransition, useRef } from "react";
import { Eye, EyeOff, Loader2, Save, Trash2, GripVertical, Play, BookOpen } from "lucide-react";
import { upsertShowcaseCourse, removeShowcaseCourse, reorderShowcaseCourses } from "./actions";

type Course = {
  id: string;
  title: string;
  slug: string;
  thumbnail_url: string | null;
  priceFormatted: string;
  checkout_url: string | null;
  course_type: "course" | "material";
  showcase: {
    course_id: string;
    sales_video_panda_id: string | null;
    position: number;
    active: boolean;
  } | null;
};

export default function VitrineManager({ courses }: { courses: Course[] }) {
  const inVitrine = courses.filter((c) => c.showcase !== null);
  const notInVitrine = courses.filter((c) => c.showcase === null);

  const vitrineCourses = inVitrine
    .filter((c) => c.course_type === "course")
    .sort((a, b) => (a.showcase!.position ?? 0) - (b.showcase!.position ?? 0));

  const vitrineMaterials = inVitrine
    .filter((c) => c.course_type === "material")
    .sort((a, b) => (a.showcase!.position ?? 0) - (b.showcase!.position ?? 0));

  const addCourses = notInVitrine.filter((c) => c.course_type === "course");
  const addMaterials = notInVitrine.filter((c) => c.course_type === "material");

  return (
    <div className="space-y-10">
      {/* ── Cursos na vitrine ─────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
          <Play className="w-4 h-4 text-[#6699F3]" />
          Cursos na vitrine ({vitrineCourses.length})
        </h2>
        {vitrineCourses.length === 0 && (
          <div className="handify-card p-6 text-center text-muted-foreground text-sm">
            Nenhum curso na vitrine. Adicione abaixo.
          </div>
        )}
        <DraggableSection items={vitrineCourses} />
      </section>

      {/* ── Materiais Didáticos na vitrine ────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-amber-600" />
          Materiais Didáticos na vitrine ({vitrineMaterials.length})
        </h2>
        {vitrineMaterials.length === 0 && (
          <div className="handify-card p-6 text-center text-muted-foreground text-sm">
            Nenhum material didático na vitrine. Adicione abaixo.
          </div>
        )}
        <DraggableSection items={vitrineMaterials} />
      </section>

      {/* ── Adicionar à vitrine ───────────────────────────────────── */}
      {(addCourses.length > 0 || addMaterials.length > 0) && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Adicionar à vitrine
          </h2>
          {addCourses.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-[#6699F3] flex items-center gap-1.5">
                <Play className="w-3 h-3" /> Cursos
              </p>
              {addCourses.map((course) => (
                <ShowcaseCard key={course.id} course={course} inVitrine={false} />
              ))}
            </div>
          )}
          {addMaterials.length > 0 && (
            <div className="space-y-2 mt-4">
              <p className="text-xs font-medium text-amber-600 flex items-center gap-1.5">
                <BookOpen className="w-3 h-3" /> Materiais Didáticos
              </p>
              {addMaterials.map((course) => (
                <ShowcaseCard key={course.id} course={course} inVitrine={false} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ─── Seção arrastável ─────────────────────────────────────────────────────────

function DraggableSection({
  items: initialItems,
}: {
  items: Course[];
}) {
  const [items, setItems] = useState(initialItems);
  const [isPending, startTransition] = useTransition();
  const dragIndex = useRef<number | null>(null);

  function handleDragStart(index: number) {
    dragIndex.current = index;
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragIndex.current === null || dragIndex.current === index) return;

    const newItems = [...items];
    const [removed] = newItems.splice(dragIndex.current, 1);
    newItems.splice(index, 0, removed);
    dragIndex.current = index;
    setItems(newItems);
  }

  function handleDrop() {
    if (items.length === 0) return;
    const reordered = items.map((item, i) => ({
      course_id: item.id,
      position: i,
    }));
    startTransition(async () => {
      await reorderShowcaseCourses(reordered);
    });
    dragIndex.current = null;
  }

  return (
    <div className="space-y-2" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
      {isPending && (
        <p className="text-xs text-[#6699F3] flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" /> Salvando ordem...
        </p>
      )}
      {items.map((course, index) => (
        <div
          key={course.id}
          draggable
          onDragStart={() => handleDragStart(index)}
          onDragOver={(e) => handleDragOver(e, index)}
          className="flex items-center gap-2 cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />
          <div className="flex-1">
            <ShowcaseCard course={course} inVitrine />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Card individual ──────────────────────────────────────────────────────────

function ShowcaseCard({
  course,
  inVitrine,
}: {
  course: Course;
  inVitrine: boolean;
}) {
  const sc = course.showcase;
  const [salesVideo, setSalesVideo] = useState(sc?.sales_video_panda_id ?? "");
  const [checkoutUrl, setCheckoutUrl] = useState(course.checkout_url ?? "");
  const [position, setPosition] = useState(sc?.position ?? 0);
  const [active, setActive] = useState(sc?.active ?? true);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const fd = new FormData();
    fd.set("course_id", course.id);
    fd.set("sales_video_panda_id", salesVideo);
    fd.set("checkout_url", checkoutUrl);
    fd.set("position", String(position));
    fd.set("active", String(active));

    startTransition(async () => {
      await upsertShowcaseCourse(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  const handleRemove = () => {
    startTransition(async () => {
      await removeShowcaseCourse(course.id);
    });
  };

  return (
    <div className="bg-white rounded-xl border border-border/60 p-4 space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#6699F3]/10 shrink-0">
          {course.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-lg">
              {course.course_type === "material" ? "📄" : "🎨"}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm line-clamp-1">{course.title}</p>
          <p className="text-xs text-muted-foreground">{course.priceFormatted}</p>
        </div>
        {inVitrine && (
          <button
            onClick={handleRemove}
            disabled={isPending}
            className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors"
            aria-label="Remover da vitrine"
            title="Remover da vitrine"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Campos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">ID do vídeo de vendas (Panda)</label>
          <input
            type="text"
            value={salesVideo}
            onChange={(e) => setSalesVideo(e.target.value)}
            placeholder="UUID ou URL do vídeo"
            className="w-full text-sm border border-border/60 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Link de checkout (Payt)</label>
          <input
            type="url"
            value={checkoutUrl}
            onChange={(e) => setCheckoutUrl(e.target.value)}
            placeholder="https://pay.payt.com.br/..."
            className="w-full text-sm border border-border/60 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Visível</label>
          <button
            type="button"
            onClick={() => setActive((v) => !v)}
            className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border transition-colors ${
              active
                ? "border-[#72CF92]/50 bg-[#72CF92]/10 text-[#72CF92]"
                : "border-border/60 text-muted-foreground"
            }`}
          >
            {active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {active ? "Visível na vitrine" : "Oculto"}
          </button>
        </div>
      </div>

      {/* Salvar */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-1.5 text-sm font-medium bg-[#6699F3] text-white px-4 py-1.5 rounded-lg hover:bg-[#5580d4] disabled:opacity-60 transition-colors"
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : saved ? (
            "Salvo ✓"
          ) : (
            <><Save className="w-3.5 h-3.5" />{inVitrine ? "Salvar" : "Adicionar à vitrine"}</>
          )}
        </button>
      </div>
    </div>
  );
}
