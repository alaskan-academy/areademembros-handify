import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { Trophy, BookOpen, Award, Activity, UserCheck, Clock } from "lucide-react";
import { InfoTooltip } from "../metric-tooltip";
import Image from "next/image";
import { FinancialRankings, type StudentRow, type CourseEnroll } from "./FinancialRankings";
import { StudentMiniModal } from "@/components/admin/metrics/StudentMiniModal";

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (p?.role !== "admin") redirect("/dashboard");
}

type Profile = {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  created_at: string;
};

export default async function AlunaRankingPage() {
  await assertAdmin();
  const service = createServiceClient();

  const [
    { data: progressAll },
    { data: certs },
    { data: enrollsAll },
    { data: allProfiles },
    { data: courses },
    { data: paymentEvents },
  ] = await Promise.all([
    service.from("lesson_progress").select("user_id, lesson_id, completed, updated_at"),
    service.from("certificates").select("user_id, course_id, issued_at"),
    service.from("enrollments").select("user_id, course_id, granted_at, source"),
    service.from("profiles").select("id, full_name, email, avatar_url, created_at").eq("role", "student").eq("banned", false),
    service.from("courses").select("id, title, price"),
    service.from("payment_events")
      .select("buyer_email, amount_paid")
      .eq("processed", true)
      .not("amount_paid", "is", null),
  ]);

  const profiles = (allProfiles ?? []) as Profile[];
  const profileMap = new Map<string, Profile>(profiles.map((p) => [p.id, p]));
  const coursePriceMap = new Map<string, { title: string; price: number | null }>(
    (courses ?? []).map((c) => [c.id, { title: c.title, price: c.price }])
  );

  // ── Ranking 1: Top por aulas concluídas ──────────────────────────
  const completedByUser = new Map<string, number>();
  for (const p of progressAll ?? []) {
    if (p.completed) completedByUser.set(p.user_id, (completedByUser.get(p.user_id) ?? 0) + 1);
  }
  const topByLessons = [...completedByUser.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, count]) => ({ profile: profileMap.get(id), count }))
    .filter((x) => x.profile);

  // ── Ranking 2: Top por certificados ─────────────────────────────
  const certsByUser = new Map<string, number>();
  for (const c of certs ?? []) {
    certsByUser.set(c.user_id, (certsByUser.get(c.user_id) ?? 0) + 1);
  }
  const topByCerts = [...certsByUser.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, count]) => ({ profile: profileMap.get(id), count }))
    .filter((x) => x.profile);

  // ── Ranking 3: Top por matrículas ────────────────────────────────
  const enrollsByUser = new Map<string, number>();
  for (const e of enrollsAll ?? []) {
    enrollsByUser.set(e.user_id, (enrollsByUser.get(e.user_id) ?? 0) + 1);
  }
  const topByEnrolls = [...enrollsByUser.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, count]) => ({ profile: profileMap.get(id), count }))
    .filter((x) => x.profile);

  // ── Ranking 4: Mais recentemente ativas ─────────────────────────
  const lastActiveByUser = new Map<string, string>();
  for (const p of progressAll ?? []) {
    const current = lastActiveByUser.get(p.user_id);
    if (!current || p.updated_at > current) lastActiveByUser.set(p.user_id, p.updated_at);
  }
  const recentlyActive = [...lastActiveByUser.entries()]
    .sort((a, b) => b[1].localeCompare(a[1]))
    .slice(0, 10)
    .map(([id, lastActive]) => ({ profile: profileMap.get(id), lastActive }))
    .filter((x) => x.profile);

  // ── Ranking 5: Novatas ──────────────────────────────────────────
  const newest = [...profiles]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 10);

  // ── Estatísticas de engajamento ─────────────────────────────────
  const totalProgress = progressAll?.length ?? 0;
  const totalCompleted = progressAll?.filter((p) => p.completed).length ?? 0;
  const engagementRate = totalProgress > 0 ? Math.round((totalCompleted / totalProgress) * 100) : 0;
  const alunaComCertificado = new Set(certs?.map((c) => c.user_id) ?? []).size;
  const alunaComProgresso = new Set(progressAll?.map((p) => p.user_id) ?? []).size;

  // ── Rankings financeiros ─────────────────────────────────────────
  // Gasto real por e-mail (valor pago via Payt — transaction.total_price em centavos)
  const spentByEmail = new Map<string, number>();
  const txCountByEmail = new Map<string, number>();
  for (const pe of paymentEvents ?? []) {
    if (!pe.buyer_email || !pe.amount_paid) continue;
    const email = pe.buyer_email.toLowerCase();
    spentByEmail.set(email, (spentByEmail.get(email) ?? 0) + pe.amount_paid);
    txCountByEmail.set(email, (txCountByEmail.get(email) ?? 0) + 1);
  }

  // Mapa e-mail → perfil para cruzar com payment_events
  const profileByEmail = new Map(profiles.map((p) => [p.email.toLowerCase(), p]));

  // Matrículas completas por usuária (para modal)
  const enrollsByUserFull = new Map<string, CourseEnroll[]>();
  for (const e of enrollsAll ?? []) {
    const course = coursePriceMap.get(e.course_id);
    if (!course) continue;
    if (!enrollsByUserFull.has(e.user_id)) enrollsByUserFull.set(e.user_id, []);
    enrollsByUserFull.get(e.user_id)!.push({
      courseId: e.course_id,
      courseTitle: course.title,
      price: course.price,
      source: e.source ?? "manual",
      grantedAt: e.granted_at,
    });
  }

  const topBySpent: StudentRow[] = [...spentByEmail.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([email, totalCents]) => {
      const p = profileByEmail.get(email);
      if (!p) return null;
      return {
        id: p.id,
        name: p.full_name ?? p.email,
        email: p.email,
        avatar: p.avatar_url,
        totalSpent: totalCents / 100,
        buyCount: txCountByEmail.get(email) ?? 0,
      };
    })
    .filter((x): x is StudentRow => x !== null);

  // "Mais compras" = mais transações Payt distintas
  const topByBuys: StudentRow[] = [...txCountByEmail.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([email, count]) => {
      const p = profileByEmail.get(email);
      if (!p) return null;
      return {
        id: p.id,
        name: p.full_name ?? p.email,
        email: p.email,
        avatar: p.avatar_url,
        totalSpent: (spentByEmail.get(email) ?? 0) / 100,
        buyCount: count,
      };
    })
    .filter((x): x is StudentRow => x !== null);

  // Apenas dados dos usuários relevantes para o modal (mantém prop pequena)
  const relevantIds = new Set([...topBySpent.map((s) => s.id), ...topByBuys.map((s) => s.id)]);
  const enrollmentsByUserId: Record<string, CourseEnroll[]> = {};
  for (const id of relevantIds) {
    enrollmentsByUserId[id] = enrollsByUserFull.get(id) ?? [];
  }

  return (
    <div className="space-y-8">
      {/* Cards de engajamento */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={UserCheck} label="Alunas com progresso" value={alunaComProgresso} color="#6699F3"
          tooltip="Alunas que iniciaram pelo menos uma aula — têm algum registro de progresso na plataforma." />
        <StatCard icon={BookOpen} label="Aulas concluídas total" value={totalCompleted} color="#72CF92"
          tooltip="Soma de todas as aulas marcadas como concluídas em toda a plataforma (pelo botão explícito ou ao atingir 90% do vídeo)." />
        <StatCard icon={Award} label="Com certificados" value={alunaComCertificado} color="#FEC649"
          tooltip="Número de alunas que receberam pelo menos um certificado de conclusão de curso." />
        <StatCard icon={Activity} label="Taxa de engajamento" value={`${engagementRate}%`} color="#6699F3"
          tooltip="Proporção de aulas concluídas em relação ao total de aulas iniciadas (concluídas ÷ total com progresso × 100)." />
      </div>

      {/* Rankings financeiros (Client Component — modal interativo) */}
      <FinancialRankings
        topBySpent={topBySpent}
        topByBuys={topByBuys}
        enrollmentsByUserId={enrollmentsByUserId}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top por aulas concluídas */}
        <RankingCard
          title="Mais dedicadas"
          subtitle="por aulas concluídas"
          icon={BookOpen}
          color="#6699F3"
          items={topByLessons.map(({ profile, count }) => ({
            id: profile!.id,
            name: profile!.full_name ?? profile!.email,
            email: profile!.email,
            avatar: profile!.avatar_url,
            value: `${count} aulas`,
            badge: count,
          }))}
        />

        {/* Top por certificados */}
        <RankingCard
          title="Mais certificadas"
          subtitle="por cursos concluídos"
          icon={Award}
          color="#72CF92"
          items={topByCerts.map(({ profile, count }) => ({
            id: profile!.id,
            name: profile!.full_name ?? profile!.email,
            email: profile!.email,
            avatar: profile!.avatar_url,
            value: `${count} cert.`,
            badge: count,
          }))}
        />

        {/* Top por matrículas */}
        <RankingCard
          title="Mais matrículas"
          subtitle="por cursos adquiridos"
          icon={Trophy}
          color="#FEC649"
          items={topByEnrolls.map(({ profile, count }) => ({
            id: profile!.id,
            name: profile!.full_name ?? profile!.email,
            email: profile!.email,
            avatar: profile!.avatar_url,
            value: `${count} cursos`,
            badge: count,
          }))}
        />

        {/* Últimas ativas */}
        <RankingCard
          title="Últimas ativas"
          subtitle="mais recentes na plataforma"
          icon={Clock}
          color="#6699F3"
          items={recentlyActive.map(({ profile, lastActive }) => ({
            id: profile!.id,
            name: profile!.full_name ?? profile!.email,
            email: profile!.email,
            avatar: profile!.avatar_url,
            value: formatRelativeTime(lastActive),
            badge: null,
          }))}
        />
      </div>

      {/* Novatas */}
      <div className="handify-card p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-[#72CF92]" />
          Novatas recentes
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {newest.map((p) => (
            <StudentMiniModal
              key={p.id}
              student={{ id: p.id, name: p.full_name, email: p.email, avatar: p.avatar_url, createdAt: p.created_at }}
              className="block"
            >
              <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors">
                <Avatar name={p.full_name ?? p.email} url={p.avatar_url} size={32} />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{p.full_name ?? "—"}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{p.email}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(p.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
            </StudentMiniModal>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Componentes ────────────────────────────────────────────────────

function Avatar({ name, url, size = 36 }: { name: string; url: string | null; size?: number }) {
  if (url) {
    return (
      <Image
        src={url}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 text-white font-semibold"
      style={{ width: size, height: size, background: "#6699F3", fontSize: size * 0.35 }}
    >
      {initials || "?"}
    </div>
  );
}

function RankingCard({
  title, subtitle, icon: Icon, color, items,
}: {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  items: Array<{ id: string; name: string; email: string; avatar: string | null; value: string; badge: number | null }>;
}) {
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div className="handify-card p-6">
      <h2 className="font-semibold mb-0.5 flex items-center gap-2">
        <Icon className="w-4 h-4" style={{ color }} />
        {title}
      </h2>
      <p className="text-xs text-muted-foreground mb-4">{subtitle}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum dado ainda.</p>
      ) : (
        <div className="space-y-1.5">
          {items.map(({ id, name, email, avatar, value }, i) => (
            <StudentMiniModal key={id} student={{ id, name, email, avatar }} className="block">
              <div className="flex items-center gap-3 cursor-pointer hover:bg-muted/30 rounded-xl px-2 -mx-2 py-1 transition-colors">
                <span className="text-base w-6 shrink-0 text-center">
                  {medals[i] ?? <span className="text-xs text-muted-foreground font-bold">{i + 1}</span>}
                </span>
                <Avatar name={name} url={avatar} size={32} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{name}</p>
                  <p className="text-xs text-muted-foreground truncate">{email}</p>
                </div>
                <span
                  className="text-xs font-semibold px-2 py-1 rounded-full shrink-0"
                  style={{ background: color + "20", color }}
                >
                  {value}
                </span>
              </div>
            </StudentMiniModal>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, tooltip }: {
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
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}
