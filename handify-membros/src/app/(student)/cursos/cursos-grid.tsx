"use client";

import { useState, useEffect, useRef } from "react";
import { useModalBackGuard } from "@/hooks/useModalBackGuard";
import Link from "next/link";
import {
  Clock, Play, X, Lock, RotateCcw, ChevronDown, CheckCircle,
  BookOpen, ChevronLeft, ChevronRight, Search, SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/format";
import type { CatalogCourse, CatalogCategory } from "./page";

interface CursosGridProps {
  courses: CatalogCourse[];
  categories: CatalogCategory[];
  isLoggedIn: boolean;
  headerBanner?: React.ReactNode;
  tipo?: string;
}

export default function CursosGrid({ courses, categories, isLoggedIn, headerBanner, tipo }: CursosGridProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<CatalogCourse | null>(null);
  useModalBackGuard(!!selected, () => setSelected(null));

  const filtered = courses.filter((c) => {
    if (activeCategory && c.categorySlug !== activeCategory) return false;
    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      if (!c.title.toLowerCase().includes(q) && !c.categoryName?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const enrolled = filtered.filter((c) => c.isEnrolled);
  const exploreCourses = filtered.filter((c) => !c.isEnrolled && c.course_type === "course");
  const exploreMaterials = filtered.filter((c) => !c.isEnrolled && c.course_type === "material");

  // Busca + filtros retráteis
  const SearchAndFilters = (
    <div className="mb-6 space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar curso..."
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 transition-shadow"
          />
        </div>
        {categories.length > 0 && (
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            aria-label="Filtrar por categoria"
            aria-expanded={filtersOpen}
            className={cn(
              "shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors",
              filtersOpen || activeCategory
                ? "border-[#6699F3] text-[#6699F3] bg-[#6699F3]/5"
                : "border-border text-foreground/60 hover:border-[#6699F3]/50 hover:text-[#6699F3]"
            )}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">Categoria</span>
            {activeCategory && (
              <span className="w-4 h-4 rounded-full bg-[#6699F3] text-white text-[10px] font-bold flex items-center justify-center leading-none">
                1
              </span>
            )}
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", filtersOpen && "rotate-180")} />
          </button>
        )}
      </div>

      {filtersOpen && categories.length > 0 && (
        <div className="bg-white rounded-xl border border-border/70 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Categoria
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveCategory(null)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                !activeCategory
                  ? "bg-[#6699F3] text-white shadow-sm"
                  : "bg-muted/60 text-foreground/70 hover:bg-[#6699F3]/10 hover:text-[#6699F3]"
              )}
            >
              Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.slug)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                  activeCategory === cat.slug
                    ? "bg-[#6699F3] text-white shadow-sm"
                    : "bg-muted/60 text-foreground/70 hover:bg-[#6699F3]/10 hover:text-[#6699F3]"
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
          {activeCategory && (
            <button
              onClick={() => setActiveCategory(null)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-3"
            >
              <X className="w-3 h-3" />
              Limpar filtro
            </button>
          )}
        </div>
      )}
    </div>
  );

  // Modo grade completa (ver mais)
  if (tipo === "curso" || tipo === "material") {
    const gridItems = tipo === "curso" ? exploreCourses : exploreMaterials;
    const gridTitle = tipo === "curso" ? "Todos os Cursos" : "Todos os Materiais Didáticos";
    const gridIcon = tipo === "curso"
      ? <Play className="w-5 h-5 text-[#6699F3]" />
      : <BookOpen className="w-5 h-5 text-amber-600" />;

    return (
      <>
        {/* Navegação de volta */}
        <div className="mb-6">
          <Link
            href="/cursos"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </Link>
        </div>

        {/* Cabeçalho da grade */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1 h-7 rounded-full bg-[#6699F3]" aria-hidden />
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            {gridIcon}
            {gridTitle}
          </h2>
          <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {gridItems.length}
          </span>
        </div>

        {SearchAndFilters}

        {gridItems.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {gridItems.map((course) => (
              <CourseCard key={course.id} course={course} onClick={() => setSelected(course)} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24 space-y-3">
            <p className="text-2xl">🎨</p>
            <p className="font-semibold text-lg">Nenhum item nesta categoria</p>
            <p className="text-muted-foreground">Novos conteúdos chegando em breve!</p>
          </div>
        )}

        {selected && (
          <CourseModal
            course={selected}
            isLoggedIn={isLoggedIn}
            onClose={() => setSelected(null)}
          />
        )}
      </>
    );
  }

  // Modo padrão: linhas horizontais por seção
  const hasAny = filtered.length > 0;

  return (
    <>
      {SearchAndFilters}

      {/* Meus cursos */}
      <HorizontalRow
        title="Meus cursos"
        icon={<CheckCircle className="w-4 h-4 text-[#6699F3]" />}
        courses={enrolled}
        onSelect={setSelected}
      />

      {/* Banner condicional (entre seções) */}
      {headerBanner && <div className="mb-8">{headerBanner}</div>}

      {/* Cursos — seção com destaque */}
      <HorizontalRow
        title="Cursos"
        icon={<Play className="w-4 h-4 text-[#6699F3]" />}
        courses={exploreCourses}
        onSelect={setSelected}
        featured
        elevated
        verMaisHref="/cursos?tipo=curso"
      />

      {/* Materiais Didáticos */}
      <HorizontalRow
        title="Materiais Didáticos"
        icon={<BookOpen className="w-4 h-4 text-amber-600" />}
        courses={exploreMaterials}
        onSelect={setSelected}
        verMaisHref="/cursos?tipo=material"
      />

      {!hasAny && (
        <div className="text-center py-24 space-y-3">
          <p className="text-2xl">🎨</p>
          <p className="font-semibold text-lg">Nenhum curso nesta categoria</p>
          <p className="text-muted-foreground">Novos cursos chegando em breve!</p>
        </div>
      )}

      {selected && (
        <CourseModal
          course={selected}
          isLoggedIn={isLoggedIn}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

// ─── Linha horizontal com scroll ──────────────────────────────────────────────

function HorizontalRow({
  title,
  icon,
  courses,
  onSelect,
  featured = false,
  elevated = false,
  subtitle,
  verMaisHref,
}: {
  title: string;
  icon: React.ReactNode;
  courses: CatalogCourse[];
  onSelect: (c: CatalogCourse) => void;
  featured?: boolean;
  elevated?: boolean;
  subtitle?: string;
  verMaisHref?: string;
}) {
  const rowRef = useRef<HTMLDivElement>(null);

  function scroll(dir: "left" | "right") {
    const el = rowRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.75;
    el.scrollBy({ left: dir === "right" ? amount : -amount, behavior: "smooth" });
  }

  if (!courses.length) return null;

  const header = (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        {featured && !elevated && <div className="w-1 h-6 rounded-full bg-[#6699F3]" aria-hidden />}
        <div>
          <h2 className={cn(
            "flex items-center gap-2",
            featured ? "text-lg sm:text-xl font-bold" : "text-base font-semibold text-foreground/80"
          )}>
            {icon}
            {title}
            {featured && (
              <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {courses.length}
              </span>
            )}
          </h2>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5 ml-6">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {verMaisHref && (
          <Link
            href={verMaisHref}
            className="flex items-center gap-0.5 text-xs font-medium text-[#6699F3] hover:underline shrink-0"
          >
            Ver mais
            <ChevronRight className="w-3 h-3" />
          </Link>
        )}
        <div className="hidden sm:flex gap-1">
          <button
            onClick={() => scroll("left")}
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:border-[#6699F3] hover:text-[#6699F3] transition-colors"
            aria-label="Rolar para esquerda"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:border-[#6699F3] hover:text-[#6699F3] transition-colors"
            aria-label="Rolar para direita"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  const scrollRow = (
    <div
      ref={rowRef}
      className="flex gap-4 overflow-x-auto pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] scroll-smooth"
    >
      {courses.map((course) => (
        <div key={course.id} className="shrink-0 w-[260px] sm:w-[320px]">
          <CourseCard course={course} onClick={() => onSelect(course)} />
        </div>
      ))}
      <div className="shrink-0 w-2" aria-hidden />
    </div>
  );

  if (elevated) {
    return (
      <section className="mb-12 -mx-4 sm:-mx-6 lg:-mx-8">
        <div className="bg-white border-y border-border/40 shadow-sm overflow-hidden">
          {/* Faixa tricolor */}
          <div className="flex h-[3px]">
            <span className="flex-1 bg-[#6699F3]" />
            <span className="flex-1 bg-[#72CF92]" />
            <span className="flex-1 bg-[#FEC649]" />
          </div>
          <div className="px-4 sm:px-6 lg:px-8 pt-5 pb-4">
            {header}
            {scrollRow}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-12">
      {header}
      {scrollRow}
    </section>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function CourseCard({ course, onClick }: { course: CatalogCourse; onClick: () => void }) {
  const isComplete = course.progress?.percentage === 100;
  const hasStarted = !!course.lastLessonId;
  const isLocked = !course.isEnrolled;
  const isMaterial = course.course_type === "material";

  // Cursos matriculados navegam direto para a última aula assistida (ou primeira)
  const lessonHref = course.isEnrolled
    ? course.lastLessonId
      ? `/aulas/${course.lastLessonId}`
      : course.firstLessonId
      ? `/aulas/${course.firstLessonId}`
      : null
    : null;

  const cardClassName = "block group handify-card overflow-hidden text-left w-full hover:shadow-md transition-shadow duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6699F3]";

  const cardContent = (<>
      {/* Thumbnail */}
      <div className="aspect-video relative overflow-hidden bg-[#6699F3]/10">
        {course.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.thumbnail_url}
            alt={course.title}
            className={cn(
              "w-full h-full object-cover transition-transform duration-300 group-hover:scale-105",
              isLocked && "brightness-75"
            )}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">
            {isMaterial ? "📄" : "🎨"}
          </div>
        )}

        {/* Overlay play/lock */}
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
            {isLocked
              ? <Lock className="w-4 h-4 text-[#6699F3]" />
              : <Play className="w-4 h-4 text-[#6699F3] fill-[#6699F3] ml-0.5" />
            }
          </div>
        </div>

        {/* Cadeado permanente */}
        {isLocked && (
          <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <Lock className="w-3 h-3 text-white" />
          </div>
        )}

        {/* Badge status */}
        {course.isEnrolled ? (
          <span className="absolute top-1.5 left-1.5 bg-[#6699F3] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle className="w-2.5 h-2.5" />
            {isComplete ? "Concluído" : "Matriculada"}
          </span>
        ) : course.hasPreview ? (
          <span className="absolute top-1.5 left-1.5 bg-[#72CF92] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
            Prévia grátis
          </span>
        ) : null}

        {/* Badge tipo */}
        <span className={cn(
          "absolute bottom-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full",
          isMaterial ? "bg-[#FEC649] text-[#0F0F0F]" : "bg-white/90 text-[#6699F3]"
        )}>
          {isMaterial ? "Material" : "Curso"}
        </span>
      </div>

      {/* Info — altura fixa uniforme; top cresce, bottom nunca é empurrado */}
      <div className="p-4 h-[144px] flex flex-col gap-2 overflow-hidden">
        {/* Topo: categoria + título — ocupa espaço disponível, nunca transborda */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {course.categoryName && (
            <p className="text-[10px] font-medium text-[#6699F3] uppercase tracking-wide line-clamp-1 mb-1">
              {course.categoryName}
            </p>
          )}
          <h3 className="font-bold text-sm leading-snug line-clamp-2 group-hover:text-[#6699F3] transition-colors">
            {course.title}
          </h3>
        </div>

        {/* Rodapé: progresso ou preço — sempre na base, nunca comprimido */}
        {course.isEnrolled && course.progress && course.progress.total > 0 ? (
          <div className="shrink-0 space-y-1">
            <div className="flex justify-between items-center text-[10px] text-muted-foreground">
              <span>{course.progress.completed}/{course.progress.total} aulas</span>
              <span className="font-semibold" style={{ color: isComplete ? "#72CF92" : "#6699F3" }}>
                {course.progress.percentage}%
              </span>
            </div>
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${course.progress.percentage}%`,
                  background: isComplete ? "#72CF92" : "#6699F3",
                }}
              />
            </div>
            <p className="text-[10px] font-medium" style={{ color: isComplete ? "#72CF92" : "#6699F3" }}>
              {isComplete ? "Rever" : hasStarted ? "Continuar" : "Começar"}
            </p>
          </div>
        ) : (
          <div className="shrink-0 flex items-center justify-between">
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="w-3 h-3" />
              {course.workload_hours}h
            </span>
            <span className="font-black text-sm text-[#0F0F0F]">
              {course.priceFormatted}
            </span>
          </div>
        )}
      </div>
    </>);

  if (lessonHref) {
    return <Link href={lessonHref} className={cardClassName}>{cardContent}</Link>;
  }
  return (
    <button onClick={onClick} className={cardClassName}>{cardContent}</button>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function CourseModal({
  course,
  isLoggedIn,
  onClose,
}: {
  course: CatalogCourse;
  isLoggedIn: boolean;
  onClose: () => void;
}) {
  const [videoKey, setVideoKey] = useState(0);
  const [openModules, setOpenModules] = useState<Set<string>>(new Set());
  const isMaterial = course.course_type === "material";

  useEffect(() => {
    setVideoKey((k) => k + 1);
    setOpenModules(new Set());
  }, [course.id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const embedUrl = course.sales_video_panda_id
    ? course.sales_video_panda_id.startsWith("http")
      ? course.sales_video_panda_id
      : `https://player.pandavideo.com.br/embed/?v=${encodeURIComponent(course.sales_video_panda_id)}`
    : null;

  const isComplete = course.progress?.percentage === 100;
  const hasStarted = !!course.lastLessonId;
  const ctaHref = course.isEnrolled
    ? course.lastLessonId
      ? `/aulas/${course.lastLessonId}`
      : course.firstLessonId
      ? `/aulas/${course.firstLessonId}`
      : `/cursos/${course.slug}`
    : course.checkout_url ?? `/cursos/${course.slug}`;

  const toggleModule = (id: string) => {
    setOpenModules((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={`Detalhes: ${course.title}`}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-2">
            {course.categoryName && (
              <span className="text-xs font-medium text-[#6699F3] uppercase tracking-wide">
                {course.categoryName}
              </span>
            )}
            <span className={cn(
              "text-[10px] font-bold px-2 py-0.5 rounded-full",
              isMaterial ? "bg-[#FEC649] text-[#0F0F0F]" : "bg-[#6699F3]/15 text-[#6699F3]"
            )}>
              {isMaterial ? "Material Didático" : "Curso"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="ml-auto p-1.5 rounded-full text-muted-foreground hover:bg-muted transition-colors"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Vídeo ou thumbnail */}
        {embedUrl ? (
          <div className="w-full aspect-video bg-black">
            <iframe
              key={videoKey}
              src={embedUrl}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              className="w-full h-full border-0"
              title={`Apresentação: ${course.title}`}
            />
          </div>
        ) : course.thumbnail_url ? (
          <div className="w-full aspect-video overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
          </div>
        ) : null}

        {/* Conteúdo */}
        <div className="px-6 py-5 space-y-4">
          <h2 className="text-xl font-bold leading-snug">{course.title}</h2>

          {course.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{course.description}</p>
          )}

          {/* Meta */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground border-t border-border/60 pt-4">
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {course.workload_hours}h de conteúdo
            </span>
            <span className="flex items-center gap-1.5">
              <Play className="w-4 h-4" />
              {course.totalLessons} aulas
            </span>
            {course.hasPreview && (
              <span className="flex items-center gap-1.5 text-[#72CF92] font-medium">
                <Play className="w-4 h-4" />
                Prévia grátis disponível
              </span>
            )}
          </div>

          {/* Módulos */}
          {course.modules.length > 0 && (
            <div className="border-t border-border/60 pt-4 space-y-1.5">
              <h3 className="text-sm font-semibold mb-2">Conteúdo do curso</h3>
              {course.modules.map((mod, i) => {
                const isOpen = openModules.has(mod.id);
                const modDuration = mod.lessons.reduce((acc, l) => acc + (l.duration_seconds ?? 0), 0);
                return (
                  <div key={mod.id} className="rounded-lg border border-border/60 overflow-hidden">
                    <button
                      onClick={() => toggleModule(mod.id)}
                      className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/50 hover:bg-muted transition-colors text-left"
                    >
                      <span className="text-sm font-medium">Módulo {i + 1} — {mod.title}</span>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground shrink-0 ml-2">
                        {mod.lessons.length} aulas
                        {modDuration > 0 && ` · ${formatDuration(modDuration)}`}
                        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", isOpen && "rotate-180")} />
                      </span>
                    </button>
                    {isOpen && (
                      <div className="divide-y divide-border/30">
                        {mod.lessons.map((lesson) => (
                          <div key={lesson.id} className="flex items-center justify-between px-3 py-2 text-xs">
                            <span className="flex items-center gap-2 text-muted-foreground min-w-0">
                              {lesson.is_preview
                                ? <Play className="w-3 h-3 text-[#72CF92] shrink-0" />
                                : <Lock className="w-3 h-3 shrink-0" />
                              }
                              <span className="truncate">{lesson.title}</span>
                              {lesson.is_preview && (
                                <span className="text-[#72CF92] font-medium shrink-0">Prévia</span>
                              )}
                            </span>
                            {lesson.duration_seconds > 0 && (
                              <span className="text-muted-foreground shrink-0 ml-2">
                                {formatDuration(lesson.duration_seconds)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* CTA */}
          <div className="border-t border-border/60 pt-4">
            {course.isEnrolled ? (
              <div className="space-y-3">
                {course.progress && course.progress.total > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{course.progress.completed}/{course.progress.total} aulas</span>
                      <span className="font-semibold" style={{ color: isComplete ? "#72CF92" : "#6699F3" }}>
                        {course.progress.percentage}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${course.progress.percentage}%`, background: isComplete ? "#72CF92" : "#6699F3" }}
                      />
                    </div>
                  </div>
                )}
                <Link
                  href={ctaHref}
                  onClick={onClose}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors",
                    isComplete ? "bg-[#72CF92] hover:bg-[#5bb577]" : "bg-[#6699F3] hover:bg-[#5580d4]"
                  )}
                >
                  {isComplete
                    ? <><RotateCcw className="w-4 h-4" /> Rever curso</>
                    : hasStarted
                    ? <><Play className="w-4 h-4 fill-current" /> Continuar curso</>
                    : <><Play className="w-4 h-4" /> Começar curso</>
                  }
                </Link>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-2xl font-black text-[#0F0F0F]">{course.priceFormatted}</p>
                  {!isLoggedIn && (
                    <p className="text-xs text-muted-foreground mt-0.5">Precisa de uma conta para comprar</p>
                  )}
                </div>
                <div className="flex flex-row gap-2 flex-wrap">
                  {!isLoggedIn && (
                    <Link
                      href="/cadastro"
                      onClick={onClose}
                      className="text-sm font-medium text-[#6699F3] hover:underline px-3 py-2 text-center"
                    >
                      Criar conta
                    </Link>
                  )}
                  <a
                    href={ctaHref}
                    target={course.checkout_url ? "_blank" : undefined}
                    rel={course.checkout_url ? "noopener noreferrer" : undefined}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#6699F3] hover:bg-[#5580d4] transition-colors"
                  >
                    Comprar agora
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
