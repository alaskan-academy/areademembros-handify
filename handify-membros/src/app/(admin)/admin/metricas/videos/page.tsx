import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { getVideos, formatDuration, formatStorage } from "@/lib/video/panda-api";
import { InfoTooltip } from "../metric-tooltip";
import { Video, Clock, HardDrive, Link2, Play, AlertCircle } from "lucide-react";
import Image from "next/image";

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

  // Busca vídeos do Panda e lições do Supabase em paralelo
  const [pandaResult, { data: lessons }, { data: progressData }] = await Promise.all([
    getVideos(200),
    service
      .from("lessons")
      .select("id, title, video_panda_id, module:modules(course_id, courses(title, slug))")
      .not("video_panda_id", "is", null),
    service
      .from("lesson_progress")
      .select("lesson_id")
      .eq("completed", true),
  ]);

  const pandaConfigured = !!process.env.PANDA_VIDEO_API_KEY;
  const pandaVideos = pandaResult?.videos ?? [];
  const pandaTotal = pandaResult?.total ?? 0;

  // Mapa video_panda_id → info da lição
  type LessonInfo = { lessonId: string; lessonTitle: string; courseTitle: string; courseSlug: string };
  const lessonByVideoId = new Map<string, LessonInfo>();
  for (const l of lessons ?? []) {
    if (!l.video_panda_id) continue;
    const mod = l.module as unknown as { courses: { title: string; slug: string } | null } | null;
    lessonByVideoId.set(l.video_panda_id, {
      lessonId: l.id,
      lessonTitle: l.title,
      courseTitle: mod?.courses?.title ?? "—",
      courseSlug: mod?.courses?.slug ?? "",
    });
  }

  // Conclusões internas por lição
  const completedByLesson = new Map<string, number>();
  for (const p of progressData ?? []) {
    completedByLesson.set(p.lesson_id, (completedByLesson.get(p.lesson_id) ?? 0) + 1);
  }

  // Enriquece vídeos Panda com dados de lição + conclusões
  const enriched = pandaVideos.map((v) => {
    const lesson = lessonByVideoId.get(v.video_external_id) ?? null;
    const completions = lesson ? (completedByLesson.get(lesson.lessonId) ?? 0) : 0;
    return { ...v, lesson, completions };
  });

  // Cards de resumo
  const totalDuration = pandaVideos.reduce((s, v) => s + (v.length ?? 0), 0);
  const totalStorage = pandaVideos.reduce((s, v) => s + (v.storage_size ?? 0), 0);
  const linkedCount = enriched.filter((v) => v.lesson !== null).length;

  // Ranking interno: top aulas por conclusão
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

  // Ordena tabela por conclusões desc, depois por duração desc
  const sortedVideos = [...enriched].sort((a, b) => b.completions - a.completions || b.length - a.length);

  return (
    <div className="space-y-8">
      {!pandaConfigured && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span><strong>PANDA_VIDEO_API_KEY</strong> não configurada. Configure nas env vars para ver a biblioteca de vídeos.</span>
        </div>
      )}

      {/* Cards de resumo da biblioteca */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={Video} label="Total de vídeos" value={pandaTotal || pandaVideos.length}
          color="#6699F3"
          tooltip="Total de vídeos na biblioteca Panda Video da conta."
        />
        <SummaryCard
          icon={Clock} label="Duração total" value={formatDuration(totalDuration)}
          color="#72CF92"
          tooltip="Soma das durações de todos os vídeos da biblioteca Panda Video."
        />
        <SummaryCard
          icon={HardDrive} label="Armazenamento" value={formatStorage(totalStorage)}
          color="#FEC649"
          tooltip="Espaço total ocupado pelos vídeos na biblioteca Panda Video."
        />
        <SummaryCard
          icon={Link2} label="Vinculados a aulas" value={linkedCount}
          color="#6699F3"
          tooltip="Vídeos do Panda que estão vinculados a uma aula cadastrada na plataforma."
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ranking interno de conclusões */}
        <div className="handify-card p-6">
          <h2 className="font-semibold mb-1 flex items-center gap-2">
            <Play className="w-4 h-4 text-[#72CF92]" />
            Aulas mais concluídas
          </h2>
          <p className="text-xs text-muted-foreground mb-4">por registros internos da plataforma</p>
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

        {/* Top vídeos por duração */}
        <div className="handify-card p-6">
          <h2 className="font-semibold mb-1 flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#6699F3]" />
            Vídeos mais longos
          </h2>
          <p className="text-xs text-muted-foreground mb-4">por duração na biblioteca Panda</p>
          {pandaVideos.length === 0 ? (
            <p className="text-sm text-muted-foreground">{pandaConfigured ? "Nenhum vídeo encontrado." : "API não configurada."}</p>
          ) : (
            <div className="space-y-3">
              {[...enriched]
                .sort((a, b) => b.length - a.length)
                .slice(0, 10)
                .map((v, i) => (
                  <div key={v.id} className="flex items-start gap-3">
                    <span className="text-xs font-bold text-muted-foreground w-5 text-right mt-0.5 shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{v.lesson?.lessonTitle ?? v.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{v.lesson?.courseTitle ?? "Não vinculado"}</p>
                      <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#6699F3]"
                          style={{ width: `${Math.round((v.length / ([...enriched].sort((a, b) => b.length - a.length)[0]?.length || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-semibold tabular-nums shrink-0">{formatDuration(v.length)}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabela completa de vídeos */}
      {pandaVideos.length > 0 && (
        <div className="handify-card p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Video className="w-4 h-4 text-[#6699F3]" />
            Biblioteca completa — {pandaVideos.length} vídeos
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 font-medium text-muted-foreground w-10">#</th>
                  <th className="pb-2 font-medium text-muted-foreground">Vídeo</th>
                  <th className="pb-2 font-medium text-muted-foreground">Curso</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">Duração</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">Tamanho</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">Conclusões</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {sortedVideos.map((v, i) => (
                  <tr key={v.id} className={!v.lesson ? "opacity-50" : ""}>
                    <td className="py-2.5 pr-3 text-muted-foreground text-xs">{i + 1}</td>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2.5">
                        {v.thumbnail ? (
                          <Image
                            src={v.thumbnail}
                            alt={v.title}
                            width={48}
                            height={27}
                            className="rounded shrink-0 object-cover"
                            style={{ width: 48, height: 27 }}
                          />
                        ) : (
                          <div className="w-12 h-7 rounded bg-muted shrink-0" />
                        )}
                        <p className="truncate font-medium max-w-[180px]">
                          {v.lesson?.lessonTitle ?? v.title}
                        </p>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground text-xs truncate max-w-[140px]">
                      {v.lesson?.courseTitle ?? <span className="italic">Não vinculado</span>}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">{formatDuration(v.length)}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">{formatStorage(v.storage_size)}</td>
                    <td className="py-2.5 text-right tabular-nums font-medium">
                      {v.completions > 0 ? v.completions : <span className="text-muted-foreground">—</span>}
                    </td>
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

function SummaryCard({ icon: Icon, label, value, color, tooltip }: {
  icon: React.ElementType; label: string; value: number | string; color: string; tooltip?: string;
}) {
  return (
    <div className="handify-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color + "20" }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <span className="text-xs text-muted-foreground font-medium flex-1">{label}</span>
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
