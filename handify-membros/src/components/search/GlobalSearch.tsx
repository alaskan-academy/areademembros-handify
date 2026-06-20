"use client";

import { useState, useEffect, useRef, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, BookOpen, Play, Newspaper, X, Loader2 } from "lucide-react";
import { searchPlatform, type SearchResult, type SearchResults } from "@/lib/search/search-action";

const EMPTY: SearchResults = { courses: [], lessons: [], news: [], total: 0 };

const TYPE_META = {
  course: { label: "Cursos", icon: BookOpen, color: "#6699F3" },
  lesson: { label: "Aulas", icon: Play, color: "#72CF92" },
  news: { label: "Feed de notícias", icon: Newspaper, color: "#FEC649" },
} as const;

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Ctrl+K / ⌘K global shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults(EMPTY);
      setActiveIndex(-1);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults(EMPTY);
      setActiveIndex(-1);
      return;
    }
    const t = setTimeout(() => {
      startTransition(async () => {
        const r = await searchPlatform(query);
        setResults(r);
        setActiveIndex(-1);
      });
    }, 280);
    return () => clearTimeout(t);
  }, [query]);

  // Flat list of all results for keyboard nav
  const flat: SearchResult[] = [
    ...results.courses,
    ...results.lessons,
    ...results.news,
  ];

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0 && flat[activeIndex]) {
      navigate(flat[activeIndex].href);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Buscar (Ctrl+K)"
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/60 bg-muted/50 text-sm text-muted-foreground hover:bg-muted hover:border-border transition-colors"
      >
        <Search className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline">Buscar…</span>
        <kbd className="hidden sm:inline text-[10px] font-mono px-1 py-0.5 rounded bg-border/60 text-muted-foreground/80 leading-none">
          Ctrl+K
        </kbd>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4"
      style={{ background: "rgba(0,0,0,0.50)" }}
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-popover rounded-xl shadow-2xl border border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          {isPending ? (
            <Loader2 className="w-4 h-4 shrink-0 text-muted-foreground animate-spin" />
          ) : (
            <Search className="w-4 h-4 shrink-0 text-muted-foreground" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar cursos, aulas, posts…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            aria-label="Campo de busca"
            autoComplete="off"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setResults(EMPTY); inputRef.current?.focus(); }}
              className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd
            onClick={() => setOpen(false)}
            className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border text-muted-foreground cursor-pointer hover:bg-muted transition-colors leading-none"
          >
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {query.length < 2 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Digite pelo menos 2 caracteres para buscar.
            </div>
          ) : results.total === 0 && !isPending ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhum resultado para <strong>&ldquo;{query}&rdquo;</strong>
            </div>
          ) : (
            <div className="py-2">
              {(["courses", "lessons", "news"] as const).map((group) => {
                const items = results[group];
                if (items.length === 0) return null;
                const meta = TYPE_META[group === "courses" ? "course" : group === "lessons" ? "lesson" : "news"];
                const Icon = meta.icon;
                return (
                  <div key={group}>
                    <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                      {meta.label}
                    </p>
                    {items.map((item) => {
                      const globalIdx = flat.indexOf(item);
                      const isActive = globalIdx === activeIndex;
                      return (
                        <button
                          key={item.id}
                          onClick={() => navigate(item.href)}
                          onMouseEnter={() => setActiveIndex(globalIdx)}
                          className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors ${
                            isActive ? "bg-[#6699F3]/10" : "hover:bg-muted/60"
                          }`}
                        >
                          <div
                            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                            style={{ background: meta.color + "20" }}
                          >
                            <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{item.title}</p>
                            {item.subtitle && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {item.subtitle}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-border flex items-center gap-3 text-[10px] text-muted-foreground/60">
          <span><kbd className="font-mono">↑↓</kbd> navegar</span>
          <span><kbd className="font-mono">Enter</kbd> abrir</span>
          <span><kbd className="font-mono">Esc</kbd> fechar</span>
        </div>
      </div>
    </div>
  );
}
