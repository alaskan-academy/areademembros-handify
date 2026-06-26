import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Users, BookOpen, Award, TrendingUp,
  ShoppingBag, Image as ImageIcon, Bell, Newspaper,
  BarChart3, CheckCircle2, Clock, XCircle, Webhook,
  ArrowRight, AlertTriangle, Flag,
} from "lucide-react";

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: p } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();
  if (p?.role !== "admin") redirect("/dashboard");
  return p?.full_name as string | null;
}

const QUICK_ACTION_GROUPS = [
  {
    label: "Catálogo",
    items: [
      { href: "/admin/cursos",  icon: BookOpen, label: "Cursos",  desc: "Gerenciar catálogo e aulas",  color: "#6699F3" },
      { href: "/admin/alunos",  icon: Users,    label: "Alunas",  desc: "Matrículas e progresso",       color: "#72CF92" },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/admin/banners",      icon: ImageIcon, label: "Banners",       desc: "Promoções e destaques",       color: "#FEC649" },
      { href: "/admin/notificacoes", icon: Bell,      label: "Notificações",  desc: "Enviar avisos para alunas",   color: "#6699F3" },
    ],
  },
  {
    label: "Comunidade",
    items: [
      { href: "/admin/comunidade/feed",  icon: Newspaper, label: "Feed de Notícias",   desc: "Publicar avisos e novidades", color: "#72CF92" },
      { href: "/admin/comunidade/forum", icon: Flag,      label: "Moderação do Fórum", desc: "Aprovar e moderar posts",     color: "#6699F3" },
    ],
  },
];

export default async function AdminHomePage() {
  const adminName = await assertAdmin();
  const service = createServiceClient();

  const hourBRT = (new Date().getUTCHours() - 3 + 24) % 24;
  const greeting = hourBRT < 12 ? "Bom dia" : hourBRT < 18 ? "Boa tarde" : "Boa noite";
  const firstName = adminName?.split(" ")[0] ?? "Admin";

  const now = new Date().toISOString();

  const [
    { count: totalAlunas },
    { count: totalMatriculas },
    { count: totalCertificados },
    { count: cursosPublicados },
    { data: webhooks },
    { count: pendingReports },
    { count: pendingForumPosts },
    { count: totalForumPosts },
  ] = await Promise.all([
    service
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "student")
      .eq("banned", false),

    service
      .from("enrollments")
      .select("*", { count: "exact", head: true })
      .or(`expires_at.is.null,expires_at.gte.${now}`),

    service
      .from("certificates")
      .select("*", { count: "exact", head: true }),

    service
      .from("courses")
      .select("*", { count: "exact", head: true })
      .eq("published", true),

    service
      .from("payment_events")
      .select("id, event_type, buyer_email, product_code, processed, error, created_at")
      .order("created_at", { ascending: false })
      .limit(8),

    service
      .from("reports")
      .select("*", { count: "exact", head: true })
      .eq("resolved", false),

    service
      .from("forum_posts")
      .select("*", { count: "exact", head: true })
      .eq("approved", false),

    service
      .from("forum_posts")
      .select("*", { count: "exact", head: true }),
  ]);

  const taxaConclusao =
    totalMatriculas && totalMatriculas > 0
      ? Math.round(((totalCertificados ?? 0) / totalMatriculas) * 100)
      : 0;

  const KPI_CARDS = [
    { icon: Users,      label: "Alunas ativas",     value: totalAlunas ?? 0,      color: "#6699F3" },
    { icon: BookOpen,   label: "Matrículas ativas",  value: totalMatriculas ?? 0,   color: "#72CF92" },
    { icon: Award,      label: "Certificados",        value: totalCertificados ?? 0, color: "#FEC649" },
    { icon: TrendingUp, label: "Taxa de conclusão",   value: `${taxaConclusao}%`,   color: "#6699F3" },
  ];

  return (
    <div className="space-y-8">

      {/* Saudação */}
      <div>
        <h1 className="text-2xl font-bold text-[#2D2D2D]">
          {greeting},{" "}
          <span className="text-[#6699F3]">{firstName}!</span>
        </h1>
        <p className="text-sm text-[#2D2D2D]/50 mt-1">
          {new Date().toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Alertas de moderação */}
      {((pendingReports ?? 0) > 0 || (pendingForumPosts ?? 0) > 0) && (
        <div className="space-y-2">
          {(pendingReports ?? 0) > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#FEC649]/15 border border-[#FEC649]/40">
              <AlertTriangle className="w-5 h-5 text-[#b07d00] shrink-0" />
              <p className="text-sm font-medium text-[#2D2D2D] flex-1">
                <span className="font-bold">{pendingReports}</span>{" "}
                {pendingReports === 1 ? "denúncia aguarda" : "denúncias aguardam"} revisão
              </p>
              <Link
                href="/admin/comunidade/forum"
                className="text-xs font-semibold text-[#6699F3] hover:underline flex items-center gap-1 shrink-0"
              >
                Revisar <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}
          {(pendingForumPosts ?? 0) > 0 && (
            <Link
              href="/admin/comunidade/forum"
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#6699F3]/10 border border-[#6699F3]/30 hover:bg-[#6699F3]/15 transition-colors"
            >
              <Flag className="w-5 h-5 text-[#6699F3] shrink-0" />
              <p className="text-sm font-medium text-[#2D2D2D] flex-1">
                <span className="font-bold text-[#6699F3]">{pendingForumPosts}</span>{" "}
                {pendingForumPosts === 1 ? "post aguarda aprovação" : "posts aguardam aprovação"}
                {" · "}
                <span className="text-[#2D2D2D]/50">{totalForumPosts ?? 0} no total</span>
              </p>
              <ArrowRight className="w-4 h-4 text-[#6699F3] shrink-0" />
            </Link>
          )}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_CARDS.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="handify-card p-5">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
              style={{ background: color + "20" }}
            >
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <p className="text-2xl font-bold text-[#2D2D2D]">{value}</p>
            <p className="text-xs text-[#2D2D2D]/50 mt-1 font-medium">{label}</p>
          </div>
        ))}
      </div>

      {/* Atalhos rápidos — grid 3 colunas full-width */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-[#2D2D2D]/50 uppercase tracking-wider">
          Acesso rápido
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {QUICK_ACTION_GROUPS.flatMap((g) => g.items).map(({ href, icon: Icon, label, desc, color }) => (
            <Link
              key={href}
              href={href}
              className="handify-card p-4 flex items-center gap-4 hover:shadow-md transition-shadow group"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: color + "20" }}
              >
                <Icon className="w-5 h-5 shrink-0" style={{ color }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#2D2D2D]">{label}</p>
                <p className="text-xs text-[#2D2D2D]/50 mt-0.5 truncate">{desc}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-[#2D2D2D]/20 group-hover:text-[#6699F3] transition-colors shrink-0" />
            </Link>
          ))}
        </div>
      </div>

      {/* Webhooks + Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Webhooks recentes */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#2D2D2D]/50 uppercase tracking-wider">
              Últimos pagamentos
            </h2>
            <Link href="/admin/metricas" className="text-xs text-[#6699F3] hover:underline font-medium">
              Ver todos
            </Link>
          </div>
          <div className="handify-card divide-y divide-border/50">
            {(webhooks ?? []).length === 0 ? (
              <p className="p-4 text-sm text-[#2D2D2D]/40">Nenhum webhook ainda.</p>
            ) : (
              (webhooks ?? []).map((w) => (
                <div key={w.id} className="flex items-start gap-3 p-3">
                  <WebhookDot processed={w.processed} error={w.error} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[#2D2D2D] truncate">
                      {w.buyer_email ?? "—"}
                    </p>
                    <p className="text-[11px] text-[#2D2D2D]/40 mt-0.5">
                      <code className="bg-[#2D2D2D]/6 px-1 rounded">{w.event_type}</code>
                      {" · "}
                      {new Date(w.created_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sidebar direita — Métricas + Cursos publicados */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[#2D2D2D]/50 uppercase tracking-wider">
            Visão geral
          </h2>
          <div className="handify-card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#72CF92]/20 flex items-center justify-center shrink-0">
              <Webhook className="w-4 h-4 text-[#72CF92]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-[#2D2D2D]/40 font-medium uppercase tracking-wide">Cursos publicados</p>
              <p className="text-xl font-bold text-[#2D2D2D]">{cursosPublicados ?? 0}</p>
            </div>
            <Link href="/admin/cursos" className="text-xs font-semibold text-[#6699F3] hover:underline flex items-center gap-1 shrink-0">
              Ver <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <Link
            href="/admin/metricas"
            className="handify-card p-4 flex items-center gap-3 hover:shadow-md transition-shadow group"
          >
            <div className="w-9 h-9 rounded-xl bg-[#6699F3]/10 flex items-center justify-center shrink-0">
              <BarChart3 className="w-4 h-4 text-[#6699F3]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#2D2D2D]">Métricas completas</p>
              <p className="text-xs text-[#2D2D2D]/50">Top cursos, funil, vídeos</p>
            </div>
            <ArrowRight className="w-4 h-4 text-[#2D2D2D]/20 group-hover:text-[#6699F3] transition-colors shrink-0" />
          </Link>
        </div>
      </div>

    </div>
  );
}

function WebhookDot({
  processed,
  error,
}: {
  processed: boolean | null;
  error: string | null;
}) {
  if (error)
    return <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />;
  if (processed)
    return <CheckCircle2 className="w-4 h-4 text-[#72CF92] shrink-0 mt-0.5" />;
  return <Clock className="w-4 h-4 text-[#FEC649] shrink-0 mt-0.5" />;
}
