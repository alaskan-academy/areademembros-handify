import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { Users, BookOpen, Award, Webhook, TrendingUp, CheckCircle2, Clock, XCircle, Bell } from "lucide-react";
import { InfoTooltip } from "./metric-tooltip";

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (p?.role !== "admin") redirect("/dashboard");
}

export default async function MetricasPage() {
  await assertAdmin();
  const service = createServiceClient();

  const [
    { count: totalAlunas },
    { count: totalMatriculas },
    { count: totalCertificados },
    { count: cursosPublicados },
    { data: topCursos },
    { data: webhooksRecentes },
    { data: matriculasPorFonte },
    { data: pushSubsData },
  ] = await Promise.all([
    // Alunas ativas (não banidas)
    service.from("profiles").select("*", { count: "exact", head: true })
      .eq("role", "student").eq("banned", false),

    // Total de matrículas ativas (sem expiração ou ainda válidas)
    service.from("enrollments").select("*", { count: "exact", head: true })
      .or("expires_at.is.null,expires_at.gte." + new Date().toISOString()),

    // Certificados emitidos
    service.from("certificates").select("*", { count: "exact", head: true }),

    // Cursos publicados
    service.from("courses").select("*", { count: "exact", head: true }).eq("published", true),

    // Top cursos por matrículas
    service.from("enrollments")
      .select("course_id, courses(title, slug, thumbnail_url)")
      .or("expires_at.is.null,expires_at.gte." + new Date().toISOString()),

    // Webhooks recentes
    service.from("payment_events")
      .select("id, platform, product_code, event_type, buyer_email, processed, error, created_at")
      .order("created_at", { ascending: false })
      .limit(15),

    // Matrículas por fonte
    service.from("enrollments")
      .select("source")
      .or("expires_at.is.null,expires_at.gte." + new Date().toISOString()),

    // Alunas com push ativo (distinct user_id)
    service.from("push_subscriptions").select("user_id"),
  ]);

  // Agrupa top cursos por course_id
  const cursoContagem = new Map<string, { title: string; slug: string; thumbnail_url: string | null; count: number }>();
  for (const e of topCursos ?? []) {
    const c = e.courses as unknown as { title: string; slug: string; thumbnail_url: string | null } | null;
    if (!c) continue;
    const entry = cursoContagem.get(e.course_id);
    if (entry) entry.count++;
    else cursoContagem.set(e.course_id, { ...c, count: 1 });
  }
  const topCursosOrdenados = [...cursoContagem.values()].sort((a, b) => b.count - a.count).slice(0, 8);

  // Alunas com push ativo (distinct user_ids)
  const pushAlunas = new Set((pushSubsData ?? []).map((s) => s.user_id)).size;

  // Taxa de conclusão = certificados / matrículas (%)
  const taxaConclusao = totalMatriculas && totalMatriculas > 0
    ? Math.round(((totalCertificados ?? 0) / totalMatriculas) * 100)
    : 0;

  // Matrículas por fonte
  const fontes = (matriculasPorFonte ?? []).reduce<Record<string, number>>((acc, e) => {
    acc[e.source] = (acc[e.source] ?? 0) + 1;
    return acc;
  }, {});

  const FONTE_LABEL: Record<string, string> = {
    payt: "Payt (compra)",
    manual: "Manual (admin)",
    subscription: "Assinatura",
  };

  return (
    <div className="space-y-8">

      {/* Cards de totais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Alunas ativas" value={totalAlunas ?? 0} color="#6699F3"
          tooltip="Alunas com conta ativa e não banidas na plataforma." />
        <StatCard icon={BookOpen} label="Matrículas ativas" value={totalMatriculas ?? 0} color="#72CF92"
          tooltip="Matrículas com acesso vigente — vitalícias ou dentro do prazo de validade." />
        <StatCard icon={Award} label="Certificados emitidos" value={totalCertificados ?? 0} color="#FEC649"
          tooltip="Total de certificados de conclusão gerados na plataforma." />
        <StatCard icon={TrendingUp} label="Taxa de conclusão" value={`${taxaConclusao}%`} color="#6699F3"
          tooltip="Proporção de certificados em relação às matrículas ativas (certificados ÷ matrículas × 100)." />
      </div>

      {/* Push */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Bell} label="Push ativas" value={pushAlunas} color="#72CF92"
          tooltip="Alunas com notificações push habilitadas em pelo menos um dispositivo." />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top cursos */}
        <div className="lg:col-span-2 handify-card p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#6699F3]" />
            Top cursos por matrículas
          </h2>
          {topCursosOrdenados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma matrícula ainda.</p>
          ) : (
            <div className="space-y-3">
              {topCursosOrdenados.map((curso, i) => (
                <div key={curso.slug} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-5 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{curso.title}</p>
                    <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#6699F3]"
                        style={{ width: `${Math.round((curso.count / (topCursosOrdenados[0]?.count || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{curso.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Matrículas por fonte + cursos publicados */}
        <div className="space-y-4">
          <div className="handify-card p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#72CF92]" />
              Origem das matrículas
            </h2>
            <div className="space-y-2">
              {Object.entries(fontes).length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados.</p>
              ) : (
                Object.entries(fontes).map(([fonte, qtd]) => (
                  <div key={fonte} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{FONTE_LABEL[fonte] ?? fonte}</span>
                    <span className="font-semibold tabular-nums">{qtd}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="handify-card p-6">
            <h2 className="font-semibold mb-1 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#FEC649]" />
              Cursos publicados
            </h2>
            <p className="text-3xl font-bold mt-2">{cursosPublicados ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Webhooks recentes */}
      <div className="handify-card p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Webhook className="w-4 h-4 text-[#6699F3]" />
          Webhooks Payt recentes
        </h2>
        {(webhooksRecentes ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum webhook recebido ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 font-medium text-muted-foreground">Status</th>
                  <th className="pb-2 font-medium text-muted-foreground">Evento</th>
                  <th className="pb-2 font-medium text-muted-foreground">Produto</th>
                  <th className="pb-2 font-medium text-muted-foreground">E-mail</th>
                  <th className="pb-2 font-medium text-muted-foreground">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {(webhooksRecentes ?? []).map((w) => (
                  <tr key={w.id}>
                    <td className="py-2.5 pr-4">
                      <WebhookStatus processed={w.processed} error={w.error} />
                    </td>
                    <td className="py-2.5 pr-4">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{w.event_type}</code>
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{w.product_code ?? "—"}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground truncate max-w-[200px]">{w.buyer_email ?? "—"}</td>
                    <td className="py-2.5 text-muted-foreground whitespace-nowrap">
                      {new Date(w.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

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

function WebhookStatus({ processed, error }: { processed: boolean | null; error: string | null }) {
  if (error) return (
    <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
      <XCircle className="w-3.5 h-3.5" /> Erro
    </span>
  );
  if (processed) return (
    <span className="inline-flex items-center gap-1 text-xs text-[#72CF92] font-medium">
      <CheckCircle2 className="w-3.5 h-3.5" /> Processado
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs text-[#FEC649] font-medium">
      <Clock className="w-3.5 h-3.5" /> Pendente
    </span>
  );
}
