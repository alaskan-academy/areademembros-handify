"use client";

import { useState } from "react";
import { MessageSquare, MessageCircle, Newspaper, Store, CheckCircle2, Heart, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";

export type ActivityItem = {
  id: string;
  type: "forum_post" | "forum_comment" | "news_comment" | "suggestion" | "lesson_completed" | "insp_like" | "insp_bookmark";
  content: string;
  context?: string;
  status?: string;
  date: string;
};

type FilterKey = "all" | "forum" | "comments" | "lessons" | "suggestions" | "inspiracoes";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all",         label: "Tudo" },
  { key: "forum",       label: "Posts no fórum" },
  { key: "comments",    label: "Comentários" },
  { key: "lessons",     label: "Aulas" },
  { key: "suggestions", label: "Sugestões" },
  { key: "inspiracoes", label: "Inspirações" },
];

const TYPE_CONFIG = {
  forum_post:      { icon: MessageSquare,  label: "Post no fórum",         color: "#6699F3", bg: "bg-[#6699F3]/10",  filter: "forum"       as FilterKey },
  forum_comment:   { icon: MessageCircle,  label: "Comentário no fórum",   color: "#6699F3", bg: "bg-[#6699F3]/10",  filter: "comments"    as FilterKey },
  news_comment:    { icon: Newspaper,      label: "Comentário nos avisos",  color: "#72CF92", bg: "bg-[#72CF92]/10",  filter: "comments"    as FilterKey },
  suggestion:      { icon: Store,          label: "Sugestão de fornecedor", color: "#FEC649", bg: "bg-[#FEC649]/15",  filter: "suggestions" as FilterKey },
  lesson_completed:{ icon: CheckCircle2,   label: "Aula concluída",         color: "#72CF92", bg: "bg-[#72CF92]/10",  filter: "lessons"     as FilterKey },
  insp_like:       { icon: Heart,          label: "Curtiu inspiração",      color: "#f87171", bg: "bg-red-50",        filter: "inspiracoes" as FilterKey },
  insp_bookmark:   { icon: Bookmark,       label: "Salvou inspiração",      color: "#6699F3", bg: "bg-[#6699F3]/10",  filter: "inspiracoes" as FilterKey },
};

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "hoje";
  if (diffDays === 1) return "há 1 dia";
  if (diffDays < 30) return `há ${diffDays} dias`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return "há 1 mês";
  if (diffMonths < 12) return `há ${diffMonths} meses`;
  const diffYears = Math.floor(diffMonths / 12);
  return diffYears === 1 ? "há 1 ano" : `há ${diffYears} anos`;
}

export default function ActivityTab({ items }: { items: ActivityItem[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const filtered = filter === "all"
    ? items
    : items.filter((i) => TYPE_CONFIG[i.type].filter === filter);

  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm font-medium text-muted-foreground">Nenhuma atividade registrada</p>
        <p className="text-xs text-muted-foreground mt-1">As ações da aluna aparecerão aqui</p>
      </div>
    );
  }

  const forumPosts      = items.filter((i) => i.type === "forum_post").length;
  const comments        = items.filter((i) => i.type === "forum_comment" || i.type === "news_comment").length;
  const suggestions     = items.filter((i) => i.type === "suggestion").length;
  const lessonsCompleted = items.filter((i) => i.type === "lesson_completed").length;
  const inspLikes       = items.filter((i) => i.type === "insp_like").length;
  const inspBookmarks   = items.filter((i) => i.type === "insp_bookmark").length;
  const score = forumPosts * 3 + comments * 2 + suggestions * 3 + lessonsCompleted + inspLikes + inspBookmarks * 2;

  return (
    <div className="space-y-4">
      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {forumPosts > 0 && (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#6699F3]/10 text-[#6699F3]">
            {forumPosts} post{forumPosts !== 1 ? "s" : ""} no fórum
          </span>
        )}
        {comments > 0 && (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#6699F3]/10 text-[#6699F3]">
            {comments} comentário{comments !== 1 ? "s" : ""}
          </span>
        )}
        {lessonsCompleted > 0 && (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#72CF92]/10 text-[#5bb577]">
            {lessonsCompleted} aula{lessonsCompleted !== 1 ? "s" : ""} concluída{lessonsCompleted !== 1 ? "s" : ""}
          </span>
        )}
        {suggestions > 0 && (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#FEC649]/15 text-yellow-700">
            {suggestions} sugestão{suggestions !== 1 ? "ões" : ""}
          </span>
        )}
        {(inspLikes + inspBookmarks) > 0 && (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-500">
            {inspLikes} curtida{inspLikes !== 1 ? "s" : ""} · {inspBookmarks} salvo{inspBookmarks !== 1 ? "s" : ""}
          </span>
        )}
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
          {score} pts
        </span>
      </div>

      {/* Filtros */}
      <div className="flex gap-1.5 flex-wrap">
        {FILTERS.map((f) => {
          const count = f.key === "all"
            ? items.length
            : items.filter((i) => TYPE_CONFIG[i.type].filter === f.key).length;
          if (count === 0 && f.key !== "all") return null;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-medium transition-colors border",
                filter === f.key
                  ? "bg-[#6699F3] text-white border-[#6699F3]"
                  : "bg-white text-muted-foreground border-border hover:border-[#6699F3]/40 hover:text-foreground"
              )}
            >
              {f.label}
              {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <div className="py-10 text-center text-muted-foreground text-sm">
          Nenhuma atividade nesta categoria.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const cfg = TYPE_CONFIG[item.type];
            const Icon = cfg.icon;
            return (
              <div
                key={`${item.type}-${item.id}`}
                className="flex gap-3 p-3 rounded-xl border border-border/60 hover:bg-muted/30 transition-colors"
              >
                <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                  <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {cfg.label}
                      </p>
                      <p className="text-sm text-foreground mt-0.5 line-clamp-2">{item.content}</p>
                      {item.context && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">Em: {item.context}</p>
                      )}
                      {item.status && item.type === "suggestion" && (
                        <span
                          className={`mt-1 inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            item.status === "approved"
                              ? "bg-[#72CF92]/10 text-[#5bb577]"
                              : item.status === "rejected"
                              ? "bg-red-100 text-red-600"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {item.status === "approved"
                            ? "Aprovada"
                            : item.status === "rejected"
                            ? "Rejeitada"
                            : "Pendente"}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                      {timeAgo(item.date)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
