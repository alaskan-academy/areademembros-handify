"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, Loader2, Save, Trash2 } from "lucide-react";
import { upsertShowcaseCourse, removeShowcaseCourse } from "./actions";

type Course = {
  id: string;
  title: string;
  slug: string;
  thumbnail_url: string | null;
  priceFormatted: string;
  checkout_url: string | null;
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

  return (
    <div className="space-y-8">
      {/* Cursos na vitrine */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Na vitrine ({inVitrine.length})
        </h2>
        {!inVitrine.length && (
          <div className="handify-card p-6 text-center text-muted-foreground text-sm">
            Nenhum curso na vitrine ainda. Adicione abaixo.
          </div>
        )}
        {inVitrine
          .sort((a, b) => (a.showcase!.position ?? 0) - (b.showcase!.position ?? 0))
          .map((course) => (
            <ShowcaseCard key={course.id} course={course} inVitrine />
          ))}
      </section>

      {/* Cursos disponíveis para adicionar */}
      {notInVitrine.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Adicionar à vitrine
          </h2>
          {notInVitrine.map((course) => (
            <ShowcaseCard key={course.id} course={course} inVitrine={false} />
          ))}
        </section>
      )}
    </div>
  );
}

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
      {/* Cabeçalho do card */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#6699F3]/10 shrink-0">
          {course.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={course.thumbnail_url}
              alt={course.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-lg">🎨</div>
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

      {/* Campos de configuração */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            ID do vídeo de vendas (Panda)
          </label>
          <input
            type="text"
            value={salesVideo}
            onChange={(e) => setSalesVideo(e.target.value)}
            placeholder="UUID ou URL do vídeo"
            className="w-full text-sm border border-border/60 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Link de checkout (Payt)
          </label>
          <input
            type="url"
            value={checkoutUrl}
            onChange={(e) => setCheckoutUrl(e.target.value)}
            placeholder="https://pay.payt.com.br/..."
            className="w-full text-sm border border-border/60 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Posição</label>
          <input
            type="number"
            min={0}
            value={position}
            onChange={(e) => setPosition(Number(e.target.value))}
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
            <>
              <Save className="w-3.5 h-3.5" />
              {inVitrine ? "Salvar" : "Adicionar à vitrine"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
