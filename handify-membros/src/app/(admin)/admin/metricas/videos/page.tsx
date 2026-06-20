import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { getVideos, formatDuration, formatStorage, extractPandaVideoId } from "@/lib/video/panda-api";
import { InfoTooltip } from "../metric-tooltip";
import { Video, Clock, HardDrive, Eye, Play, AlertCircle } from "lucide-react";
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

  const [pandaResult, { data: lessons }, { data: allProgress }] = await Promise.all([
    getVideos(200),
    service
      .from("lessons")
      .select("id, title, video_panda_id, module:modules(course_id, courses(title, slug))")
      .not("video_panda_id", "is", null),
    // Todos os registros de progresso (completed ou não) = proxy de "visualizações"
    service.from("lesson_progress").select("lesson_id, completed"),
  ]);

  const pandaConfigured = !!process.env.PANDA_VIDEO_API_KEY;
  const pandaVideos = pandaResult?.videos ?? [];

  // Mapa video_external_id → info da lição
  type LessonInfo = { lessonId: string; lessonTitle: string; courseTitle: string; courseSlug: string };
  const lessonByVideoId = new Map<string, LessonInfo>();
  for (const l of lessons ?? []) {
    if (!l.video_panda_id) continue;
    const mod = l.module as unknown as { courses: { title: string; slug: string } | null } | null;
    // video_panda_id pode ser UUID ou URL completa — extrai sempre o UUID
    lessonByVideoId.set(extractPandaVideoId(l.video_panda_id), {
      lessonId: l.id,
      lessonTitle: l.title,
      courseTitle: mod?.courses?.title ?? "—",
      courseSlug: mod?.courses?.slug ?? "",
    });
  }

  // Agrega progresso por lição
  const startedByLesson = new Map<string, number>();   // qualquer progresso = "assistiu"
  const completedByLesson = new Map<string, number>(); // concluídas
  for (const p of allProgress ?? []) {
    startedByLesson.set(p.lesson_id, (startedByLesson.get(p.lesson_id) ?? 0) + 1);
    if (p.completed) completedByLesson.set(p.lesson_id, (completedByLesson.get(p.lesson_id) ?? 0) + 1);
  }

  // Apenas vídeos vinculados a lições da plataforma
  const linked = pandaVideos
    .map((v) => {
      const lesson = lessonByVideoId.get(v.video_external_id) ?? null;
      if (!lesson) return null;
      const started = startedByLesson.get(lesson.lessonId) ?? 0;
      const completed = completedByLesson.get(lesson.lessonId) ?? 0;
      return { ...v, lesson, started, completed };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  // Cards de resumo — apenas vídeos vinculados
  const totalDuration = linked.reduce((s, v) => s + (v.length ?? 0), 0);
  const totalStorage = linked.reduce((s, v) => s + (v.storage_size ?? 0), 0);
  const totalViews = linked.reduce((s, v) => s + v.started, 0);

  // Rankings
  const topByStarted = [...linked].sort((a, b) => b.started - a.started).slice(0, 10);
  const topByCompleted = [...linked].sort((a, b) => b.completed - a.completed).slice(0, 10);

  // Tabela completa ordenada por visualizações
  const sortedLinked = [...linked].sort((a, b) => b.started - a.started || b.length - a.length);
  const maxStarted = topByStarted[0]?.started || 1;

  return (
    <div className="space-y-8">
      {!pandaConfigured && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span><strong>PANDA_VIDEO_API_KEY</strong> não configurada.</span>
        </div>
      )}

      {/* Cards — apenas vídeos da plataforma */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={Video} label="Vídeos na plataforma" value={linked.length} color="#6699F3"
          tooltip="Vídeos do Panda vinculados a uma aula cadastrada na plataforma." />
        <SummaryCard icon={Clock} label="Duração total" value={formatDuration(totalDuration)} color="#72CF92"
          tooltip="Soma das durações de todos os vídeos vinculados à plataforma." />
        <SummaryCard icon={HardDrive} label="Armazenamento" value={formatStorage(totalStorage)} color="#FEC649"
          tooltip="Espaço ocupado pelos vídeos vinculados à plataforma no Panda Video." />
        <SummaryCard icon={Eye} label="Aulas iniciadas" value={totalViews} color="#6699F3"
          tooltip="Soma de alunas que iniciaram cada aula (registros de lesson_progress). Analytics de views do Panda requer autenticação AWS não disponível via API key." />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mais assistidas */}
        <div className="handify-card p-6">
          <h2 className="font-semibold mb-1 flex items-center gap-2">
            <Eye className="w-4 h-4 text-[#6699F3]" />
            Mais assistidas
          </h2>
          <p className="text-xs text-muted-foreground mb-4">por alunas com progresso registrado na plataforma</p>
          {topByStarted.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum dado ainda.</p>
          ) : (
            <div className="space-y-3">
              {topByStarted.map((v, i) => (
                <div key={v.id} className="flex items-start gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-5 text-right mt-0.5 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{v.lesson.lessonTitle}</p>
                    <p className="text-xs text-muted-foreground truncate">{v.lesson.courseTitle}</p>
                    <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-[#6699F3]"
                        style={{ width: `${Math.round((v.started / maxStarted) * 100)}%` }} />
                    </div>
                  </div>
                  <span className="text-sm font-semibold tabular-nums shrink-0">{v.started}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mais concluídas */}
        <div className="handify-card p-6">
          <h2 className="font-semibold mb-1 flex items-center gap-2">
            <Play className="w-4 h-4 text-[#72CF92]" />
            Mais concluídas
          </h2>
          <p className="text-xs text-muted-foreground mb-4">por alunas que finalizaram a aula</p>
          {topByCompleted.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma aula concluída ainda.</p>
          ) : (
            <div className="space-y-3">
              {topByCompleted.map((v, i) => (
                <div key={v.id} className="flex items-start gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-5 text-right mt-0.5 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{v.lesson.lessonTitle}</p>
                    <p className="text-xs text-muted-foreground truncate">{v.lesson.courseTitle}</p>
                    <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-[#72CF92]"
                        style={{ width: `${Math.round((v.completed / (topByCompleted[0]?.completed || 1)) * 100)}%` }} />
                    </div>
                  </div>
                  <span className="text-sm font-semibold tabular-nums shrink-0">{v.completed}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabela completa — só vídeos vinculados */}
      {linked.length > 0 && (
        <div className="handify-card p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Video className="w-4 h-4 text-[#6699F3]" />
            Todas as aulas em vídeo — {linked.length} vídeos
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 font-medium text-muted-foreground w-8">#</th>
                  <th className="pb-2 font-medium text-muted-foreground">Aula</th>
                  <th className="pb-2 font-medium text-muted-foreground">Curso</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">Duração</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">Tamanho</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">Iniciadas</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">Concluídas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {sortedLinked.map((v, i) => (
                  <tr key={v.id}>
                    <td className="py-2.5 pr-3 text-muted-foreground text-xs">{i + 1}</td>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2.5">
                        {v.thumbnail ? (
                          <Image src={v.thumbnail} alt={v.lesson.lessonTitle}
                            width={48} height={27}
                            className="rounded shrink-0 object-cover"
                            style={{ width: 48, height: 27 }} />
                        ) : (
                          <div className="w-12 h-7 rounded bg-muted shrink-0" />
                        )}
                        <p className="truncate font-medium max-w-[180px]">{v.lesson.lessonTitle}</p>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground text-xs truncate max-w-[140px]">{v.lesson.courseTitle}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">{formatDuration(v.length)}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">{formatStorage(v.storage_size)}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums font-medium">
                      {v.started > 0 ? v.started : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2.5 text-right tabular-nums font-medium">
                      {v.completed > 0 ? (
                        <span style={{ color: "#72CF92" }}>{v.completed}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            * Iniciadas = alunas com progresso registrado na plataforma. Analytics de views direto do Panda Video requer autenticação AWS, indisponível via API key.
          </p>
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
