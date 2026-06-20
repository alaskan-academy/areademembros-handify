"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Clock, Play, X, Lock, RotateCcw, ChevronDown, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/format";
import type { CatalogCourse, CatalogCategory } from "./page";

interface CursosGridProps {
  courses: CatalogCourse[];
  categories: CatalogCategory[];
  isLoggedIn: boolean;
  headerBanner?: React.ReactNode;
}

export default function CursosGrid({ courses, categories, isLoggedIn, headerBanner }: CursosGridProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState<CatalogCourse | null>(null);

  const filtered = activeCategory
    ? courses.filter((c) => c.categorySlug === activeCategory)
    : courses;

  const enrolled = filtered.filter((c) => c.isEnrolled);
  const others = filtered.filter((c) => !c.isEnrolled);

  return (
    <>
      {/* Filtro por categoria */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setActiveCategory(null)}
            className={cn(
              "px-3 py-1 rounded-full text-sm font-medium border transition-colors",
              !activeCategory
                ? "bg-[#6699F3] text-white border-[#6699F3]"
                : "border-border text-foreground/70 hover:border-[#6699F3] hover:text-[#6699F3]"
            )}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.slug)}
              className={cn(
                "px-3 py-1 rounded-full text-sm font-medium border transition-colors",
                activeCategory === cat.slug
                  ? "bg-[#6699F3] text-white border-[#6699F3]"
                  : "border-border text-foreground/70 hover:border-[#6699F3] hover:text-[#6699F3]"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Seção: Seus cursos */}
      {enrolled.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-bold mb-4">Seus cursos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {enrolled.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                onClick={() => setSelected(course)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Banner condicional — entre cursos matriculados e catálogo */}
      {headerBanner && <div className="mb-8">{headerBanner}</div>}

      {/* Seção: Explorar */}
      {others.length > 0 && (
        <section>
          {enrolled.length > 0 && (
            <h2 className="text-lg font-bold mb-4">Explorar cursos</h2>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {others.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                onClick={() => setSelected(course)}
              />
            ))}
          </div>
        </section>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-24 space-y-3">
          <p className="text-2xl">🎨</p>
          <p className="font-semibold text-lg">Nenhum curso nesta categoria</p>
          <p className="text-muted-foreground">
            Novos cursos chegando em breve!
          </p>
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

// ─── Card ─────────────────────────────────────────────────────────────────────

function CourseCard({
  course,
  onClick,
}: {
  course: CatalogCourse;
  onClick: () => void;
}) {
  const isComplete = course.progress?.percentage === 100;
  const hasStarted = !!course.lastLessonId;

  return (
    <button
      onClick={onClick}
      className="group handify-card overflow-hidden text-left w-full hover:shadow-md transition-shadow duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6699F3]"
    >
      {/* Thumbnail */}
      <div className="aspect-video relative overflow-hidden bg-[#6699F3]/10">
        {course.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.thumbnail_url}
            alt={course.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">
            🎨
          </div>
        )}

        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
            <Play className="w-5 h-5 text-[#6699F3] fill-[#6699F3] ml-0.5" />
          </div>
        </div>

        {/* Badges */}
        {course.isEnrolled ? (
          <span className="absolute top-2 left-2 bg-[#6699F3] text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            {isComplete ? "Concluído" : "Matriculada"}
          </span>
        ) : course.hasPreview ? (
          <span className="absolute top-2 left-2 bg-[#72CF92] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            Prévia grátis
          </span>
        ) : null}
      </div>

      {/* Info */}
      <div className="p-4 space-y-2">
        {course.categoryName && (
          <p className="text-xs font-medium text-[#6699F3] uppercase tracking-wide">
            {course.categoryName}
          </p>
        )}
        <h3 className="font-bold text-sm leading-snug line-clamp-2 group-hover:text-[#6699F3] transition-colors">
          {course.title}
        </h3>

        {/* Barra de progresso (se matriculada) */}
        {course.isEnrolled && course.progress && course.progress.total > 0 ? (
          <div className="space-y-1 pt-1">
            <div className="flex justify-between items-center text-[11px] text-muted-foreground">
              <span>
                {course.progress.completed}/{course.progress.total} aulas
              </span>
              <span
                className="font-semibold"
                style={{ color: isComplete ? "#72CF92" : "#6699F3" }}
              >
                {course.progress.percentage}%
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${course.progress.percentage}%`,
                  background: isComplete ? "#72CF92" : "#6699F3",
                }}
              />
            </div>
            <p className="text-xs font-medium" style={{ color: isComplete ? "#72CF92" : "#6699F3" }}>
              {isComplete ? "Rever curso" : hasStarted ? "Continuar" : "Começar"}
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between pt-1">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              {course.workload_hours}h
            </span>
            <span className="font-black text-base text-[#0F0F0F]">
              {course.priceFormatted}
            </span>
          </div>
        )}
      </div>
    </button>
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

  useEffect(() => {
    setVideoKey((k) => k + 1);
    setOpenModules(new Set());
  }, [course.id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Detalhes: ${course.title}`}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          {course.categoryName ? (
            <span className="text-xs font-medium text-[#6699F3] uppercase tracking-wide">
              {course.categoryName}
            </span>
          ) : (
            <span />
          )}
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
            <img
              src={course.thumbnail_url}
              alt={course.title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : null}

        {/* Conteúdo */}
        <div className="px-6 py-5 space-y-4">
          <h2 className="text-xl font-bold leading-snug">{course.title}</h2>

          {course.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {course.description}
            </p>
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

          {/* Módulos e aulas */}
          {course.modules.length > 0 && (
            <div className="border-t border-border/60 pt-4 space-y-1.5">
              <h3 className="text-sm font-semibold mb-2">Conteúdo do curso</h3>
              {course.modules.map((mod, i) => {
                const isOpen = openModules.has(mod.id);
                const modDuration = mod.lessons.reduce(
                  (acc, l) => acc + (l.duration_seconds ?? 0),
                  0
                );
                return (
                  <div key={mod.id} className="rounded-lg border border-border/60 overflow-hidden">
                    <button
                      onClick={() => toggleModule(mod.id)}
                      className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/50 hover:bg-muted transition-colors text-left"
                    >
                      <span className="text-sm font-medium">
                        Módulo {i + 1} — {mod.title}
                      </span>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground shrink-0 ml-2">
                        {mod.lessons.length} aulas
                        {modDuration > 0 && ` · ${formatDuration(modDuration)}`}
                        <ChevronDown
                          className={cn(
                            "w-3.5 h-3.5 transition-transform",
                            isOpen && "rotate-180"
                          )}
                        />
                      </span>
                    </button>

                    {isOpen && (
                      <div className="divide-y divide-border/30">
                        {mod.lessons.map((lesson) => (
                          <div
                            key={lesson.id}
                            className="flex items-center justify-between px-3 py-2 text-xs"
                          >
                            <span className="flex items-center gap-2 text-muted-foreground min-w-0">
                              {lesson.is_preview ? (
                                <Play className="w-3 h-3 text-[#72CF92] shrink-0" />
                              ) : (
                                <Lock className="w-3 h-3 shrink-0" />
                              )}
                              <span className="truncate">{lesson.title}</span>
                              {lesson.is_preview && (
                                <span className="text-[#72CF92] font-medium shrink-0">
                                  Prévia
                                </span>
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
                {/* Progress bar */}
                {course.progress && course.progress.total > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        {course.progress.completed}/{course.progress.total} aulas
                      </span>
                      <span
                        className="font-semibold"
                        style={{ color: isComplete ? "#72CF92" : "#6699F3" }}
                      >
                        {course.progress.percentage}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${course.progress.percentage}%`,
                          background: isComplete ? "#72CF92" : "#6699F3",
                        }}
                      />
                    </div>
                  </div>
                )}
                <Link
                  href={ctaHref}
                  onClick={onClose}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors",
                    isComplete
                      ? "bg-[#72CF92] hover:bg-[#5bb577]"
                      : "bg-[#6699F3] hover:bg-[#5580d4]"
                  )}
                >
                  {isComplete ? (
                    <><RotateCcw className="w-4 h-4" /> Rever curso</>
                  ) : hasStarted ? (
                    <><Play className="w-4 h-4 fill-current" /> Continuar curso</>
                  ) : (
                    <><Play className="w-4 h-4" /> Começar curso</>
                  )}
                </Link>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-2xl font-black text-[#0F0F0F]">
                    {course.priceFormatted}
                  </p>
                  {!isLoggedIn && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Precisa de uma conta para comprar
                    </p>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  {!isLoggedIn && (
                    <Link
                      href={`/cadastro`}
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
