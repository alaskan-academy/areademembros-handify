import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import {
  getAccountAnalytics,
  getVideoRanking,
  getVideoRetention,
  formatWatchTime,
  type PandaVideoRankItem,
} from "@/lib/video/panda-api";
import { Eye, Play, Clock, Users, TrendingUp, AlertCircle } from "lucide-react";

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (p?.role !== "admin") redirect("/dashboard");
}

export default async function VideosMetricasPage() {
  await assertAdmin();
  const service = createServiceClient();

  // Busca lições com video_panda_id para cruzar com o ranking do Panda
  const { data: lessons } = await service
    .from("lessons")
    .select("id, title, video_panda_id, duration_seconds, module:modules(course_id, courses(title, slug))")
    .not("video_panda_id", "is", null);

  // Mapa video_panda_id → info da aula
  const videoMap = new Map<string, { lessonTitle: string; courseTitle: string; courseSlug: string; duration: number }>();
  for (const l of lessons ?? []) {
    if (!l.video_panda_id) continue;
    const mod = l.module as unknown as { course_id: string; courses: { title: string; slug: string } | null } | null;
    videoMap.set(l.video_panda_id, {
      lessonTitle: l.title,
      courseTitle: mod?.courses?.title ?? "—",
      courseSlug: mod?.courses?.slug ?? "",
      duration: l.duration_seconds ?? 0,
    });
  }

  // Busca dados do Panda em paralelo
  const [accountData, rankingData] = await Promise.all([
    getAccountAnalytics(),
    getVideoRanking(30),
  ]);

  const pandaConfigured = !!process.env.PANDA_VIDEO_API_KEY;
  const ranking = rankingData?.data ?? [];

  // Enriquece ranking com info da aula
  const enrichedRanking = ranking.map((item) => ({
    ...item,
    lesson: videoMap.get(item.video_id) ?? null,
  }));

  // Busca retenção das top 5 aulas mais assistidas
  const top5 = enrichedRanking.slice(0, 5);
  const retentionResults = await Promise.all(
    top5.map((item) => getVideoRetention(item.video_id))
  );

  // Calcula retenção média (percentual médio ao longo do vídeo → taxa de conclusão estimada)
  const retentionSummaries = top5.map((item, i) => {
    const points = retentionResults[i]?.data ?? [];
    if (!points.length) return { ...item, avgRetention: null, endRetention: null };
    const avg = Math.round(points.reduce((s, p) => s + p.percentage, 0) / points.length);
    // Retenção no último decil (90%+ do vídeo)
    const lastDecil = points.filter((p) => p.second >= (item.lesson?.duration ?? 0) * 0.9);
    const endRetention = lastDecil.length
      ? Math.round(lastDecil.reduce((s, p) => s + p.percentage, 0) / lastDecil.length)
      : null;
    return { ...item, avgRetention: avg, endRetention };
  });

  // Progresso interno (aulas concluídas) para cruzar com views do Panda
  const { data: progressData } = await service
    .from("lesson_progress")
    .select("lesson_id")
    .eq("completed", true);

  const completedByLesson = new Map<string, number>();
  for (const p of progressData ?? []) {
    completedByLesson.set(p.lesson_id, (completedByLesson.get(p.lesson_id) ?? 0) + 1);
  }

  // Top aulas por conclusão interna
  const topByCompletion = [...completedByLesson.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([lessonId, count]) => {
      const lesson = (lessons ?? []).find((l) => l.id === lessonId);
      const mod = lesson?.module as unknown as { courses: { title: string } | null } | null;
      return {
        lessonId,
        lessonTitle: lesson?.title ?? "—",
        courseTitle: mod?.courses?.title ?? "—",
        count,
      };
    });

  return (
    <div className="space-y-8">
      {!pandaConfigured && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span><strong>PANDA_VIDEO_API_KEY</strong> não configurada. Configure nas env vars da Vercel para ver dados de vídeo em tempo real.</span>
        </div>
      )}

      {/* Cards conta Panda */}
      {accountData && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <PandaCard icon={Eye} label="Visualizações totais" value={accountData.views.toLocaleString("pt-BR")} color="#6699F3" />
          <PandaCard icon={Play} label="Plays totais" value={accountData.plays.toLocaleString("pt-BR")} color="#72CF92" />
          <PandaCard icon={Clock} label="Tempo assistido" value={formatWatchTime(accountData.watch_time)} color="#FEC649" />
          <PandaCard icon={Users} label="Espectadores únicos" value={accountData.unique_viewers.toLocaleString("pt-BR")} color="#6699F3" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ranking de vídeos — Panda */}
        <div className="handify-card p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#6699F3]" />
            Vídeos mais assistidos (Panda)
          </h2>
          {enrichedRanking.length === 0 ? (
            <p className="text-sm text-muted-foreground">{pandaConfigured ? "Nenhum dado disponível ainda." : "API não configurada."}</p>
          ) : (
            <div className="space-y-3">
              {enrichedRanking.slice(0, 15).map((item, i) => (
                <div key={item.video_id} className="flex items-start gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-5 text-right mt-0.5 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.lesson?.lessonTitle ?? item.title ?? item.video_id}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.lesson?.courseTitle ?? "—"}</p>
                    <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#6699F3]"
                        style={{ width: `${Math.round((item.views / (enrichedRanking[0]?.views || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold tabular-nums">{item.views.toLocaleString("pt-BR")}</p>
                    <p className="text-xs text-muted-foreground">{item.plays.toLocaleString("pt-BR")} plays</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top aulas por conclusão interna */}
        <div className="handify-card p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Play className="w-4 h-4 text-[#72CF92]" />
            Aulas mais concluídas (plataforma)
          </h2>
          {topByCompletion.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma aula concluída ainda.</p>
          ) : (
            <div className="space-y-3">
              {topByCompletion.map((item, i) => (
                <div key={item.lessonId} className="flex items-start gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-5 text-right mt-0.5 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.lessonTitle}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.courseTitle}</p>
                    <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#72CF92]"
                        style={{ width: `${Math.round((item.count / (topByCompletion[0]?.count || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-semibold tabular-nums shrink-0">{item.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Retenção das top 5 aulas */}
      {retentionSummaries.some((r) => r.avgRetention !== null) && (
        <div className="handify-card p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#FEC649]" />
            Retenção de espectadores — Top 5 vídeos
          </h2>
          <div className="space-y-4">
            {retentionSummaries.map((item) => (
              <div key={item.video_id}>
                <div className="flex items-center justify-between mb-1">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.lesson?.lessonTitle ?? item.title ?? item.video_id}</p>
                    <p className="text-xs text-muted-foreground">{item.lesson?.courseTitle ?? "—"}</p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    {item.avgRetention !== null && (
                      <span className="text-sm font-semibold">{item.avgRetention}% médio</span>
                    )}
                    {item.endRetention !== null && (
                      <p className="text-xs text-muted-foreground">{item.endRetention}% chegam ao final</p>
                    )}
                  </div>
                </div>
                {item.avgRetention !== null && (
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${item.avgRetention}%`,
                        background: item.avgRetention >= 70 ? "#72CF92" : item.avgRetention >= 40 ? "#FEC649" : "#f87171",
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Verde ≥70% · Amarelo ≥40% · Vermelho &lt;40%
          </p>
        </div>
      )}

      {/* Tempo assistido por vídeo */}
      {enrichedRanking.length > 0 && (
        <div className="handify-card p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#6699F3]" />
            Tempo total assistido por vídeo
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 font-medium text-muted-foreground">#</th>
                  <th className="pb-2 font-medium text-muted-foreground">Aula</th>
                  <th className="pb-2 font-medium text-muted-foreground">Curso</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">Visualizações</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">Únicos</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">Tempo total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {enrichedRanking.slice(0, 20).map((item, i) => (
                  <tr key={item.video_id}>
                    <td className="py-2.5 pr-3 text-muted-foreground text-xs">{i + 1}</td>
                    <td className="py-2.5 pr-4 max-w-[180px]">
                      <p className="truncate font-medium">{item.lesson?.lessonTitle ?? item.title ?? "—"}</p>
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground truncate max-w-[140px]">
                      {item.lesson?.courseTitle ?? "—"}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{item.views.toLocaleString("pt-BR")}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">{item.unique_viewers.toLocaleString("pt-BR")}</td>
                    <td className="py-2.5 text-right tabular-nums font-medium">{formatWatchTime(item.watch_time)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function PandaCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string; color: string;
}) {
  return (
    <div className="handify-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color + "20" }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
