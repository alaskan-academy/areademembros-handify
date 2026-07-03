import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { Ghost, Zap, Target, Star, Clock, TrendingDown, Users, Award } from "lucide-react";
import { InfoTooltip } from "../metric-tooltip";
import { StudentMiniModal, type StudentBasic } from "@/components/admin/metrics/StudentMiniModal";
import { StudentListModal } from "@/components/admin/metrics/StudentListModal";
import { FunnelTableClient, type FunnelRowData } from "./FunnelTableClient";

type Profile = { id: string; full_name: string | null; email: string; avatar_url: string | null };
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
      .select("id, full_name, email, avatar_url")
      .eq("role", "student")
      .eq("banned", false),
  ]);

  // ── Mapa: lessonId → courseId + title ────────────────────────────
  const lessonCourseMap = new Map<string, string>();
  const lessonTitleMap = new Map<string, string>();
  const lessonCountByCourse = new Map<string, number>();
  for (const l of lessons ?? []) {
    const courseId = (l.module as unknown as { course_id: string } | null)?.course_id;
    if (!courseId) continue;
    lessonCourseMap.set(l.id, courseId);
    lessonTitleMap.set(l.id, l.title);
    lessonCountByCourse.set(courseId, (lessonCountByCourse.get(courseId) ?? 0) + 1);
  }

  // ── Mapas de progresso ────────────────────────────────────────────
  const startedByCourse = new Map<string, Set<string>>();
  const completedCountByUserCourse = new Map<string, number>();
  const lastActiveByUserCourse = new Map<string, string>();
  const firstProgressByUserCourse = new Map<string, string>();
  const stalledLessonCount = new Map<string, number>();

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

  // ── Certificados ─────────────────────────────────────────────────
  const certsByUserCourse = new Set<string>(); // `userId:courseId`
  const certsByUser = new Map<string, number>();
  const certUserIdsByCourse = new Map<string, string[]>();
  for (const c of certs ?? []) {
    certsByUserCourse.add(`${c.user_id}:${c.course_id}`);
    certsByUser.set(c.user_id, (certsByUser.get(c.user_id) ?? 0) + 1);
    if (!certUserIdsByCourse.has(c.course_id)) certUserIdsByCourse.set(c.course_id, []);
    certUserIdsByCourse.get(c.course_id)!.push(c.user_id);
  }

  // ── Matrículas por curso ─────────────────────────────────────────
  type EnrollEntry = { userId: string; grantedAt: string };
  const enrollByCourse = new Map<string, EnrollEntry[]>();
  for (const e of enrollments ?? []) {
    if (!enrollByCourse.has(e.course_id)) enrollByCourse.set(e.course_id, []);
    enrollByCourse.get(e.course_id)!.push({ userId: e.user_id, grantedAt: e.granted_at });
  }

  // ── Mapa de profiles ─────────────────────────────────────────────
  const profileMap = new Map<string, Profile>((profiles ?? []).map((p) => [p.id, p]));
  const courseMap = new Map((courses ?? []).map((c) => [c.id, c.title]));

  const toBasic = (userId: string): StudentBasic | null => {
    const p = profileMap.get(userId);
    if (!p) return null;
    return { id: userId, name: p.full_name, email: p.email, avatar: p.avatar_url };
  };

  const toBasicFromProfile = (p: Profile): StudentBasic => ({
    id: p.id,
    name: p.full_name,
    email: p.email,
    avatar: p.avatar_url,
  });

  // ── Funil por curso ──────────────────────────────────────────────
  const courseFunnels: FunnelRowData[] = (courses ?? [])
    .map((course) => {
      const enrolledEntries = enrollByCourse.get(course.id) ?? [];
      const totalLessons = lessonCountByCourse.get(course.id) ?? 0;

      const enrolledStudents: StudentBasic[] = [];
      const startedStudents: StudentBasic[] = [];
      const q50Students: StudentBasic[] = [];
      const q75Students: StudentBasic[] = [];
      let totalActivDays = 0, activCount = 0;

      for (const { userId, grantedAt } of enrolledEntries) {
        const s = toBasic(userId);
        if (s) enrolledStudents.push(s);

        const hasStarted = startedByCourse.get(course.id)?.has(userId) ?? false;
        if (!hasStarted) continue;
        if (s) startedStudents.push(s);

        const key = `${userId}:${course.id}`;
        const firstProgress = firstProgressByUserCourse.get(key);
        if (firstProgress) {
          const days = (new Date(firstProgress).getTime() - new Date(grantedAt).getTime()) / 86400000;
          if (days >= 0) { totalActivDays += days; activCount++; }
        }

        if (totalLessons === 0) continue;
        const completed = completedCountByUserCourse.get(key) ?? 0;
        const pct = completed / totalLessons;
        if (pct >= 0.5 && s) q50Students.push(s);
        if (pct >= 0.75 && s) q75Students.push(s);
      }

      const certifiedStudents: StudentBasic[] = (certUserIdsByCourse.get(course.id) ?? [])
        .map((uid) => toBasic(uid))
        .filter((s): s is StudentBasic => s !== null);

      return {
        courseId: course.id,
        title: course.title,
        enrolledCount: enrolledStudents.length,
        startedCount: startedStudents.length,
        q50Count: q50Students.length,
        q75Count: q75Students.length,
        certifiedCount: certifiedStudents.length,
        avgActivationDays: activCount > 0 ? Math.round(totalActivDays / activCount) : null,
        enrolledStudents,
        startedStudents,
        q50Students,
        q75Students,
        certifiedStudents,
      };
    })
    .filter((f) => f.enrolledCount > 0)
    .sort((a, b) => b.enrolledCount - a.enrolledCount);

  // ── Segmentos ────────────────────────────────────────────────────
  const ghosts: SegmentEntry[] = [];
  const stalled: SegmentEntry[] = [];
  const nearCompletion: SegmentEntry[] = [];
  const upsellReady: SegmentEntry[] = [];

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
          tooltip="Percentual de alunas matriculadas que assistiram pelo menos uma aula."
        />
        <StatCard
          icon={Award}
          label="Taxa de conclusão"
          value={`${taxaConclusao}%`}
          color="#FEC649"
          tooltip="Percentual de matrículas que resultaram em certificado."
        />
        <StatCard
          icon={Clock}
          label="Dias até 1ª aula"
          value={avgActivDays !== null ? `${avgActivDays}d` : "—"}
          color="#6699F3"
          tooltip="Média de dias entre a data da matrícula e a primeira aula assistida."
        />
      </div>

      {/* Funil por curso */}
      <div className="handify-card p-6">
        <h2 className="font-semibold mb-1 flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-[#6699F3]" />
          Funil de conclusão por curso
        </h2>
        <p className="text-xs text-muted-foreground mb-5">
          Clique em qualquer número para ver as alunas daquele grupo. Clique no nome do curso para editar.
        </p>
        <FunnelTableClient rows={courseFunnels} />
      </div>

      {/* Segmentos */}
      <div>
        <h2 className="font-semibold mb-1 flex items-center gap-2">
          <Users className="w-4 h-4 text-[#6699F3]" />
          Segmentos acionáveis para pós-venda
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Clique no número de cada segmento para ver todas as alunas. Clique em um nome para ver o perfil.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SegmentCard
            icon={Ghost}
            label="Fantasmas"
            color="#2D2D2D"
            count={ghosts.length}
            items={ghosts.slice(0, 5)}
            tooltip="Matriculadas mas nunca assistiram nenhuma aula. Oportunidade de reengajamento com e-mail de boas-vindas ou oferta de suporte."
            allStudents={ghosts.map(({ profile }) => toBasicFromProfile(profile))}
          />
          <SegmentCard
            icon={TrendingDown}
            label="Travadas"
            color="#FEC649"
            count={stalled.length}
            items={stalled.slice(0, 5)}
            tooltip="Iniciaram o curso mas ficaram inativas por 7+ dias e ainda não concluíram. Candidatas a e-mail de reengajamento."
            allStudents={stalled.map(({ profile }) => toBasicFromProfile(profile))}
          />
          <SegmentCard
            icon={Target}
            label="Quase lá"
            color="#6699F3"
            count={nearCompletion.length}
            items={nearCompletion.slice(0, 5)}
            tooltip="Completaram 75%+ das aulas mas ainda não têm certificado. Um empurrãozinho pode fechar a conclusão."
            allStudents={nearCompletion.map(({ profile }) => toBasicFromProfile(profile))}
          />
          <SegmentCard
            icon={Star}
            label="Prontas p/ upsell"
            color="#72CF92"
            count={upsellReady.length}
            items={upsellReady.slice(0, 5)}
            tooltip="Já concluíram pelo menos um curso com certificado. Fãs da plataforma — alvo ideal para oferecer novos cursos."
            allStudents={upsellReady.map(({ profile }) => toBasicFromProfile(profile))}
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

function SegmentCard({
  icon: Icon, label, color, count, items, tooltip, allStudents,
}: {
  icon: React.ElementType;
  label: string;
  color: string;
  count: number;
  items: SegmentEntry[];
  tooltip: string;
  allStudents: StudentBasic[];
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
            <StudentListModal
              title={label}
              subtitle={`${count} aluna${count !== 1 ? "s" : ""} neste segmento`}
              students={allStudents}
            >
              <span
                className="text-2xl font-bold leading-tight cursor-pointer hover:opacity-70 transition-opacity block"
                style={{ color }}
              >
                {count}
              </span>
            </StudentListModal>
          </div>
        </div>
        <InfoTooltip text={tooltip} />
      </div>

      {items.length > 0 && (
        <div className="space-y-1.5 border-t border-border/60 pt-3">
          {items.map(({ profile, courseTitle, extra }) => (
            <StudentMiniModal
              key={profile.id + courseTitle}
              student={{ id: profile.id, name: profile.full_name, email: profile.email, avatar: profile.avatar_url }}
              className="block cursor-pointer"
            >
              <div className="min-w-0 hover:bg-muted/40 rounded-lg px-1 py-0.5 -mx-1 transition-colors">
                <p className="text-xs font-medium truncate">{profile.full_name ?? profile.email}</p>
                {courseTitle && (
                  <p className="text-[10px] text-muted-foreground truncate">{courseTitle}</p>
                )}
                {extra && (
                  <p className="text-[10px] font-medium" style={{ color }}>{extra}</p>
                )}
              </div>
            </StudentMiniModal>
          ))}
          {count > items.length && (
            <StudentListModal
              title={label}
              subtitle={`${count} aluna${count !== 1 ? "s" : ""} neste segmento`}
              students={allStudents}
            >
              <p className="text-[10px] text-muted-foreground pt-1 cursor-pointer hover:text-[#6699F3] transition-colors">
                +{count - items.length} outras — ver todas
              </p>
            </StudentListModal>
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
