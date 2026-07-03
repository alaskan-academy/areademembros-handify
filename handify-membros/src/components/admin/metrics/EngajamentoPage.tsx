"use client";

import { useRouter } from "next/navigation";
import { Trophy, MessageSquare, MessageCircle, Store, Users, CheckCircle2, Heart, Bookmark, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { StudentMiniModal } from "./StudentMiniModal";

export type EngajamentoEntry = {
  userId: string;
  profile: { full_name: string | null; email: string; avatar_url: string | null };
  score: number;
  forumPosts: number;
  forumComments: number;
  suggestions: number;
  lessonsCompleted: number;
  inspLikes: number;
  inspBookmarks: number;
  inspComments: number;
};

interface Props {
  ranking: EngajamentoEntry[];
  totals: {
    posts: number;
    comments: number;
    suggestions: number;
    lessonsCompleted: number;
    activeStudents: number;
    inspLikes: number;
    inspBookmarks: number;
    inspComments: number;
  };
  periodo: string;
}

const PERIODS = [
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "all", label: "Tudo" },
];

export default function EngajamentoPage({ ranking, totals, periodo }: Props) {
  const router = useRouter();

  function setPeriodo(p: string) {
    const url =
      p === "all"
        ? "/admin/metricas/engajamento"
        : `/admin/metricas/engajamento?periodo=${p}`;
    router.replace(url);
  }

  return (
    <div className="space-y-6">
      {/* Header + period selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-semibold text-lg">Engajamento da Comunidade</h2>
          <p className="text-sm text-muted-foreground">
            Alunas mais ativas em posts, comentários, sugestões e aulas concluídas
          </p>
        </div>
        <div className="flex gap-1 bg-muted rounded-xl p-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriodo(p.value)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-lg transition-all",
                periodo === p.value
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="handify-card p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Users className="w-3.5 h-3.5 text-[#6699F3]" />
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Ativas
            </p>
          </div>
          <p className="text-2xl font-bold">{totals.activeStudents}</p>
        </div>
        <div className="handify-card p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <MessageSquare className="w-3.5 h-3.5 text-[#6699F3]" />
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Posts
            </p>
          </div>
          <p className="text-2xl font-bold">{totals.posts}</p>
        </div>
        <div className="handify-card p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <MessageCircle className="w-3.5 h-3.5 text-[#72CF92]" />
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Coment.
            </p>
          </div>
          <p className="text-2xl font-bold">{totals.comments}</p>
        </div>
        <div className="handify-card p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Store className="w-3.5 h-3.5 text-[#FEC649]" />
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Sugestões
            </p>
          </div>
          <p className="text-2xl font-bold">{totals.suggestions}</p>
        </div>
        <div className="handify-card p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#72CF92]" />
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Aulas
            </p>
          </div>
          <p className="text-2xl font-bold">{totals.lessonsCompleted}</p>
        </div>
        <div className="handify-card p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Heart className="w-3.5 h-3.5 text-red-400" />
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Curtidas
            </p>
          </div>
          <p className="text-2xl font-bold">{totals.inspLikes}</p>
        </div>
        <div className="handify-card p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Bookmark className="w-3.5 h-3.5 text-[#6699F3]" />
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Salvos
            </p>
          </div>
          <p className="text-2xl font-bold">{totals.inspBookmarks}</p>
        </div>
        <div className="handify-card p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-[#FEC649]" />
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Em Insp.
            </p>
          </div>
          <p className="text-2xl font-bold">{totals.inspComments}</p>
        </div>
      </div>

      {/* Ranking table */}
      <div className="handify-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-[#FEC649]" />
          <h3 className="font-semibold">Top 20 — Mais Engajadas</h3>
          <span className="ml-auto text-xs text-muted-foreground hidden sm:block">
            post×3 · coment×2 · sugestão×3 · aula×1 · curtida×1 · salvo×2 · coment.insp×3
          </span>
        </div>
        {ranking.length === 0 ? (
          <div className="py-16 text-center">
            <Trophy className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma atividade no período</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {ranking.map((entry, idx) => {
              const initial =
                entry.profile.full_name?.charAt(0)?.toUpperCase() ?? "?";
              const displayName =
                entry.profile.full_name ||
                (entry.profile.email && entry.profile.email !== entry.userId
                  ? entry.profile.email
                  : null) ||
                "Aluna sem nome";
              const maxScore = ranking[0]?.score ?? 1;
              const pct = Math.round((entry.score / maxScore) * 100);
              const totalComments = entry.forumComments;
              const totalInsp = entry.inspLikes + entry.inspBookmarks + entry.inspComments;

              return (
                <div key={entry.userId} className="px-5 py-4 flex items-center gap-4">
                  {/* Rank */}
                  <div
                    className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                      idx === 0
                        ? "bg-[#FEC649]/20 text-yellow-700"
                        : idx === 1
                        ? "bg-muted text-muted-foreground"
                        : idx === 2
                        ? "bg-orange-100 text-orange-700"
                        : "text-muted-foreground"
                    )}
                  >
                    {idx + 1}
                  </div>

                  {/* Avatar */}
                  {entry.profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={entry.profile.avatar_url}
                      alt=""
                      className="w-9 h-9 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-[#6699F3]/15 flex items-center justify-center text-sm font-bold text-[#6699F3] shrink-0">
                      {initial}
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <StudentMiniModal
                        student={{
                          id: entry.userId,
                          name: entry.profile.full_name,
                          email: entry.profile.email,
                          avatar: entry.profile.avatar_url,
                        }}
                        className="inline"
                      >
                        <span className="text-sm font-semibold hover:text-[#6699F3] transition-colors truncate cursor-pointer">
                          {displayName}
                        </span>
                      </StudentMiniModal>
                      <span className="text-sm font-bold text-[#6699F3] shrink-0">
                        {entry.score} pts
                      </span>
                    </div>
                    {/* Score bar */}
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#6699F3] transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {/* Breakdown chips */}
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {entry.forumPosts > 0 && (
                        <span className="text-[11px] text-muted-foreground">
                          <span className="font-semibold">{entry.forumPosts}</span> post
                          {entry.forumPosts !== 1 ? "s" : ""}
                        </span>
                      )}
                      {totalComments > 0 && (
                        <span className="text-[11px] text-muted-foreground">
                          <span className="font-semibold">{totalComments}</span> coment.
                        </span>
                      )}
                      {entry.suggestions > 0 && (
                        <span className="text-[11px] text-muted-foreground">
                          <span className="font-semibold">{entry.suggestions}</span> sugest.
                        </span>
                      )}
                      {entry.lessonsCompleted > 0 && (
                        <span className="text-[11px] text-muted-foreground">
                          <span className="font-semibold">{entry.lessonsCompleted}</span> aula
                          {entry.lessonsCompleted !== 1 ? "s" : ""}
                        </span>
                      )}
                      {totalInsp > 0 && (
                        <span className="text-[11px] text-muted-foreground">
                          ✦ <span className="font-semibold">{totalInsp}</span> insp.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
