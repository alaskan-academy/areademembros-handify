import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { Ghost, Zap, Target, Star, Clock, TrendingDown, Users, Award } from "lucide-react";
import { InfoTooltip } from "../metric-tooltip";

type Profile = { id: string; full_name: string | null; email: string };
type SegmentEntry = { profile: Profile; courseTitle: string; extra?: string };

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (p?.role !== "admin") redirect("/dashboard");
}

export default async function FunilPage() {
  await assertAdmin();
  const service = createServiceClient();

  const now = new Date().toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: enrollments },
    { data: allProgress },
    { data: certs },
    { data: courses },
    { data: lessons },
    { data: profiles },
  ] = await Promise.all([
    service
      .from("enrollments")
      .select("user_id, course_id, granted_at")
      .or(`expires_at.is.null,expires_at.gte.${now}`),
    service.from("lesson_progress").select("user_id, lesson_id, completed, updated_at"),
    service.from("certificates").select("user_id, course_id, issued_at"),
    service.from("courses").select("id, title").eq("published", true),
    service.from("lessons").select("id, title, module:modules(course_id)"),
    service
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "student")
      .eq("banned", false),
  ]);

  // ── Mapa: lessonId → courseId + title ────────────────────────────
  const lessonCourseMap = new Map<string, string>(); // lessonId → courseId
  const lessonTitleMap = new Map<string, string>();  // lessonId → title
  const lessonCountByCourse = new Map<string, number>(); // courseId → total lições
  for (const l of lessons ?? []) {
    const courseId = (l.module as unknown as { course_id: string } | null)?.course_id;
    if (!courseId) continue;
    lessonCourseMap.set(l.id, courseId);
    lessonTitleMap.set(l.id, l.title);
    lessonCountByCourse.set(courseId, (lessonCountByCourse.get(courseId) ?? 0) + 1);
  }

  // ── Mapas de progresso ────────────────────────────────────────────
  const startedByCourse = new Map<string, Set<string>>(); // courseId → Set<userId>
  const completedCountByUserCourse = new Map<string, number>(); // `userId:courseId` → count
  const lastActiveByUserCourse = new Map<string, string>(); // `userId:courseId` → ISO date
  const firstProgressByUserCourse = new Map<string, string>(); // `userId:courseId` → earliest ISO date
  const stalledLessonCount = new Map<string, number>(); // lessonId → usuárias travadas

  for (const p of allProgress ?? []) {
    const courseId = lessonCourseMap.get(p.lesson_id);
    if (!courseId) continue;
    const key = `${p.user_id}:${courseId}`;

    if (!startedByCourse.has(courseId)) startedByCourse.set(courseId, new Set());
    startedByCourse.get(courseId)!.add(p.user_id);

    if (p.completed) {
      completedCountByUserCourse.set(key, (completedCountByUserCourse.get(key) ?? 0) + 1);
    } else {
      stalledLessonCount.set(p.lesson_id, (stalledLessonCount.get(p.lesson_id) ?? 0) + 1);
    }

    const currentLast = lastActiveByUserCourse.get(key);
    if (!currentLast || p.updated_at > currentLast) lastActiveByUserCourse.set(key, p.updated_at);

    const currentFirst = firstProgressByUserCourse.get(key);
    if (!currentFirst || p.updated_at < currentFirst) firstProgressByUserCourse.set(key, p.updated_at);
  }

  // ── Certificados por usuária e por curso ─────────────────────────
  const certsByUserCourse = new Set<string>(); // `userId:courseId`
  const certsByUser = new Map<string, number>(); // userId → total certs
  const certsByCourse = new Map<string, number>(); // courseId → total certs
  for (const c of certs ?? []) {
    certsByUserCourse.add(`${c.user_id}:${c.course_id}`);
    certsByUser.set(c.user_id, (certsByUser.get(c.user_id) ?? 0) + 1);
    certsByCourse.set(c.course_id, (certsByCourse.get(c.course_id) ?? 0) + 1);
  }

  // ── Matrículas por curso ─────────────────────────────────────────
  type EnrollEntry = { userId: string; grantedAt: string };
  const enrollByCourse = new Map<string, EnrollEntry[]>();
  for (const e of enrollments ?? []) {
    if (!enrollByCourse.has(e.course_id)) enrollByCourse.set(e.course_id, []);
    enrollByCourse.get(e.course_id)!.push({ userId: e.user_id, grantedAt: e.granted_at });
  }

  // ── Funil por curso ──────────────────────────────────────────────
  type CourseFunnel = {
    courseId: string;
    title: string;
    enrolled: number;
    started: number;
    q50: number;
    q75: number;
    certified: number;
    avgActivationDays: number | null;
  };

  const courseFunnels: CourseFunnel[] = (courses ?? [])
    .map((course) => {
      const enrolled = enrollByCourse.get(course.id) ?? [];
      const totalLessons = lessonCountByCourse.get(course.id) ?? 0;
      let started = 0, q50 = 0, q75 = 0;
      let totalActivDays = 0, activCount = 0;

      for (const { userId, grantedAt } of enrolled) {
        const key = `${userId}:${course.id}`;
        const hasStarted = startedByCourse.get(course.id)?.has(userId) ?? false;
        if (!hasStarted) continue;
        started++;

        const firstProgress = firstProgressByUserCourse.get(key);
        if (firstProgress) {
          const days = (new Date(firstProgress).getTime() - new Date(grantedAt).getTime()) / 86400000;
          if (days >= 0) { totalActivDays += days; activCount++; }
        }

        if (totalLessons === 0) continue;
        const completed = completedCountByUserCourse.get(key) ?? 0;
        const pct = completed / totalLessons;
        if (pct >= 0.5) q50++;
        if (pct >= 0.75) q75++;
      }

      return {
        courseId: course.id,
        title: course.title,
        enrolled: enrolled.length,
        started,
        q50,
        q75,
        certified: certsByCourse.get(course.id) ?? 0,
        avgActivationDays: activCount > 0 ? Math.round(totalActivDays / activCount) : null,
      };
    })
    .filter((f) => f.enrolled > 0)
    .sort((a, b) => b.enrolled - a.enrolled);

  // ── Segmentos ───────────────────────────────────────────────────
  const profileMap = new Map<string, Profile>((profiles ?? []).map((p) => [p.id, p]));
  const courseMap = new Map((courses ?? []).map((c) => [c.id, c.title]));

  const ghosts: SegmentEntry[] = [];
  const stalled: SegmentEntry[] = [];
  const nearCompletion: SegmentEntry[] = [];
  const upsellReady: SegmentEntry[] = [];

  // Usuárias já processadas por segmento (evita duplicatas)
  const ghostUsers = new Set<string>();
  const stalledUsers = new Set<string>();
  const nearUsers = new Set<string>();

  for (const e of enrollments ?? []) {
    const profile = profileMap.get(e.user_id);
    if (!profile) continue;
    const courseTitle = courseMap.get(e.course_id) ?? "—";
    const key = `${e.user_id}:${e.course_id}`;
    const hasCert = certsByUserCourse.has(key);
    if (hasCert) continue;

    const hasStarted = startedByCourse.get(e.course_id)?.has(e.user_id) ?? false;

    if (!hasStarted) {
      if (!ghostUsers.has(e.user_id)) {
        ghostUsers.add(e.user_id);
        ghosts.push({ profile, courseTitle });
      }
      continue;
    }

    const totalLessons = lessonCountByCourse.get(e.course_id) ?? 0;
    const completed = completedCountByUserCourse.get(key) ?? 0;
    const pct = totalLessons > 0 ? completed / totalLessons : 0;
    const lastActive = lastActiveByUserCourse.get(key) ?? "";

    if (pct >= 0.75 && !nearUsers.has(e.user_id)) {
      nearUsers.add(e.user_id);
      nearCompletion.push({ profile, courseTitle, extra: `${Math.round(pct * 100)}% concluído` });
    } else if (lastActive < sevenDaysAgo && !stalledUsers.has(e.user_id)) {
      stalledUsers.add(e.user_id);
      stalled.push({ profile, courseTitle, extra: formatRelativeTime(lastActive) });
    }
  }

  // Upsell: tem pelo menos 1 certificado
  for (const [userId, count] of certsByUser.entries()) {
    const profile = profileMap.get(userId);
    if (!profile) continue;
    upsellReady.push({ profile, courseTitle: "", extra: `${count} cert.` });
  }
  upsellReady.sort((a, b) => {
    const ca = parseInt(a.extra ?? "0");
    const cb = parseInt(b.extra ?? "0");
    return cb - ca;
  });

  // ── Aulas onde mais alunas travaram ──────────────────────────────
  const topStalledLessons = [...stalledLessonCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([lessonId, count]) => ({
      lessonId,
      lessonTitle: lessonTitleMap.get(lessonId) ?? "—",
      courseTitle: courseMap.get(lessonCourseMap.get(lessonId) ?? "") ?? "—",
      count,
    }));

  // ── Totais globais ────────────────────────────────────────────────
  const totalEnrollments = enrollments?.length ?? 0;
  const allStartedUsers = new Set(allProgress?.map((p) => p.user_id) ?? []).size;
  const taxaAtivacao = totalEnrollments > 0
    ? Math.round((allStartedUsers / totalEnrollments) * 100)
    : 0;
  const totalCerts = certs?.length ?? 0;
  const taxaConclusao = totalEnrollments > 0
    ? Math.round((totalCerts / totalEnrollments) * 100)
    : 0;

  // Tempo médio global de ativação
  let globalActivDays = 0, globalActivCount = 0;
  for (const [key, firstProgress] of firstProgressByUserCourse.entries()) {
    const [userId, courseId] = key.split(":");
    const enroll = (enrollByCourse.get(courseId) ?? []).find((e) => e.userId === userId);
    if (!enroll) continue;
    const days = (new Date(firstProgress).getTime() - new Date(enroll.grantedAt).getTime()) / 86400000;
    if (days >= 0) { globalActivDays += days; globalActivCount++; }
  }
  const avgActivDays = globalActivCount > 0 ? Math.round(globalActivDays / globalActivCount) : null;

  return (
    <div className="space-y-8">

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Total de matrículas"
          value={totalEnrollments}
          color="#6699F3"
          tooltip="Matrículas ativas com acesso vigente (vitalício ou dentro do prazo)."
        />
        <StatCard
          icon={Zap}
          label="Taxa de ativação"
          value={`${taxaAtivacao}%`}
          color="#72CF92"
          tooltip="Percentual de alunas matriculadas que assistiram pelo menos uma aula (têm algum registro de progresso)."
        />
        <StatCard
          icon={Award}
          label="Taxa de conclusão"
          value={`${taxaConclusao}%`}
          color="#FEC649"
          tooltip="Percentual de matrículas que resultaram em certificado (certificados ÷ matrículas × 100)."
        />
        <StatCard
          icon={Clock}
          label="Dias até 1ª aula"
          value={avgActivDays !== null ? `${avgActivDays}d` : "—"}
          color="#6699F3"
          tooltip="Média de dias entre a data da matrícula e a primeira aula assistida. Quanto menor, mais rápida a ativação."
        />
      </div>

      {/* Funil por curso */}
      <div className="handify-card p-6">
        <h2 className="font-semibold mb-1 flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-[#6699F3]" />
          Funil de conclusão por curso
        </h2>
        <p className="text-xs text-muted-foreground mb-5">
          Cada linha mostra quantas alunas avançaram em cada etapa do curso.
        </p>
        {courseFunnels.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum curso com matrículas ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 font-medium text-muted-foreground">Curso</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">Matrículas</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">Iniciaram</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">50%+</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">75%+</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">Certificadas</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right whitespace-nowrap">
                    Dias até 1ª aula
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {courseFunnels.map((f) => {
                  const pct = (n: number) =>
                    f.enrolled > 0 ? Math.round((n / f.enrolled) * 100) : 0;
                  return (
                    <tr key={f.courseId}>
                      <td className="py-3 pr-4 font-medium max-w-[200px] truncate">{f.title}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">{f.enrolled}</td>
                      <FunnelCell value={f.started} pct={pct(f.started)} color="#6699F3" />
                      <FunnelCell value={f.q50} pct={pct(f.q50)} color="#72CF92" />
                      <FunnelCell value={f.q75} pct={pct(f.q75)} color="#FEC649" />
                      <FunnelCell value={f.certified} pct={pct(f.certified)} color="#72CF92" highlight />
                      <td className="py-3 text-right tabular-nums text-muted-foreground text-xs">
                        {f.avgActivationDays !== null ? `${f.avgActivationDays}d` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Segmentos */}
      <div>
        <h2 className="font-semibold mb-1 flex items-center gap-2">
          <Users className="w-4 h-4 text-[#6699F3]" />
          Segmentos acionáveis para pós-venda
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Grupos de alunas prontos para abordagem direcionada.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SegmentCard
            icon={Ghost}
            label="Fantasmas"
            color="#2D2D2D"
            count={ghosts.length}
            items={ghosts.slice(0, 5)}
            tooltip="Matriculadas mas nunca assistiram nenhuma aula. Oportunidade de reengajamento com e-mail de boas-vindas ou oferta de suporte."
          />
          <SegmentCard
            icon={TrendingDown}
            label="Travadas"
            color="#FEC649"
            count={stalled.length}
            items={stalled.slice(0, 5)}
            tooltip="Iniciaram o curso mas ficaram inativas por 7+ dias e ainda não concluíram. Candidatas a e-mail de reengajamento."
          />
          <SegmentCard
            icon={Target}
            label="Quase lá"
            color="#6699F3"
            count={nearCompletion.length}
            items={nearCompletion.slice(0, 5)}
            tooltip="Completaram 75%+ das aulas mas ainda não têm certificado. Um empurrãozinho pode fechar a conclusão."
          />
          <SegmentCard
            icon={Star}
            label="Prontas p/ upsell"
            color="#72CF92"
            count={upsellReady.length}
            items={upsellReady.slice(0, 5)}
            tooltip="Já concluíram pelo menos um curso com certificado. Fãs da plataforma — alvo ideal para oferecer novos cursos."
          />
        </div>
      </div>

      {/* Aulas onde mais alunas travaram */}
      {topStalledLessons.length > 0 && (
        <div className="handify-card p-6">
          <h2 className="font-semibold mb-1 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-[#FEC649]" />
            Aulas onde mais alunas travaram
            <InfoTooltip text="Aulas com progresso registrado mas ainda não concluídas — indicam pontos de abandono ou dificuldade no conteúdo." />
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            Conteúdo que pode precisar de revisão, material complementar ou suporte extra.
          </p>
          <div className="space-y-2.5">
            {topStalledLessons.map((lesson, i) => (
              <div key={lesson.lessonId} className="flex items-center gap-3">
                <span className="text-xs font-bold text-muted-foreground w-5 text-right shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{lesson.lessonTitle}</p>
                  <p className="text-xs text-muted-foreground truncate">{lesson.courseTitle}</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                  style={{ background: "#FEC64920", color: "#b8880a" }}>
                  {lesson.count} travada{lesson.count !== 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componentes ──────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color, tooltip }: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
  tooltip?: string;
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
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}

function FunnelCell({
  value, pct, color, highlight = false,
}: {
  value: number; pct: number; color: string; highlight?: boolean;
}) {
  return (
    <td className="py-3 pr-4 text-right tabular-nums">
      <span className={highlight ? "font-semibold" : ""} style={highlight ? { color } : undefined}>
        {value}
      </span>
      <span className="text-xs text-muted-foreground ml-1.5">({pct}%)</span>
    </td>
  );
}

function SegmentCard({
  icon: Icon, label, color, count, items, tooltip,
}: {
  icon: React.ElementType;
  label: string;
  color: string;
  count: number;
  items: SegmentEntry[];
  tooltip: string;
}) {
  return (
    <div className="handify-card p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: color + "18" }}>
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
          <div>
            <p className="text-sm font-semibold">{label}</p>
            <p className="text-2xl font-bold leading-tight" style={{ color }}>{count}</p>
          </div>
        </div>
        <InfoTooltip text={tooltip} />
      </div>

      {items.length > 0 && (
        <div className="space-y-1.5 border-t border-border/60 pt-3">
          {items.map(({ profile, courseTitle, extra }) => (
            <div key={profile.id + courseTitle} className="min-w-0">
              <p className="text-xs font-medium truncate">{profile.full_name ?? profile.email}</p>
              {courseTitle && (
                <p className="text-[10px] text-muted-foreground truncate">{courseTitle}</p>
              )}
              {extra && (
                <p className="text-[10px] font-medium" style={{ color }}>{extra}</p>
              )}
            </div>
          ))}
          {count > items.length && (
            <p className="text-[10px] text-muted-foreground pt-1">
              +{count - items.length} outras
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d < 1) return "hoje";
  if (d === 1) return "há 1 dia";
  if (d < 30) return `há ${d} dias`;
  const m = Math.floor(d / 30);
  return `há ${m} ${m === 1 ? "mês" : "meses"}`;
}
