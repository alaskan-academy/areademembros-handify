"use client";

import { MessageSquare, MessageCircle, Newspaper, Store, CheckCircle2 } from "lucide-react";

export type ActivityItem = {
  id: string;
  type: "forum_post" | "forum_comment" | "news_comment" | "suggestion" | "lesson_completed";
  content: string;
  context?: string;
  status?: string;
  date: string;
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

const TYPE_CONFIG = {
  forum_post: { icon: MessageSquare, label: "Post no fórum", color: "#6699F3", bg: "bg-[#6699F3]/10" },
  forum_comment: { icon: MessageCircle, label: "Comentário no fórum", color: "#6699F3", bg: "bg-[#6699F3]/10" },
  news_comment: { icon: Newspaper, label: "Comentário no feed", color: "#72CF92", bg: "bg-[#72CF92]/10" },
  suggestion: { icon: Store, label: "Sugestão de fornecedor", color: "#FEC649", bg: "bg-[#FEC649]/15" },
  lesson_completed: { icon: CheckCircle2, label: "Aula concluída", color: "#72CF92", bg: "bg-[#72CF92]/10" },
};

export default function ActivityTab({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm font-medium text-muted-foreground">Nenhuma atividade registrada</p>
        <p className="text-xs text-muted-foreground mt-1">As ações da aluna aparecerão aqui</p>
      </div>
    );
  }

  const forumPosts = items.filter((i) => i.type === "forum_post").length;
  const comments = items.filter((i) => i.type === "forum_comment" || i.type === "news_comment").length;
  const suggestions = items.filter((i) => i.type === "suggestion").length;
  const lessonsCompleted = items.filter((i) => i.type === "lesson_completed").length;
  const score = forumPosts * 3 + comments * 2 + suggestions * 3 + lessonsCompleted;

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
        {suggestions > 0 && (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#FEC649]/15 text-yellow-700">
            {suggestions} sugestão{suggestions !== 1 ? "ões" : ""}
          </span>
        )}
        {lessonsCompleted > 0 && (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#72CF92]/10 text-[#5bb577]">
            {lessonsCompleted} aula{lessonsCompleted !== 1 ? "s" : ""} concluída{lessonsCompleted !== 1 ? "s" : ""}
          </span>
        )}
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
          Pontuação: {score} pts
        </span>
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        {items.map((item) => {
          const cfg = TYPE_CONFIG[item.type];
          const Icon = cfg.icon;
          return (
            <div
              key={`${item.type}-${item.id}`}
              className="flex gap-3 p-3 rounded-xl border border-border/60 hover:bg-muted/30 transition-colors"
            >
              <div
                className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}
              >
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
    </div>
  );
}
