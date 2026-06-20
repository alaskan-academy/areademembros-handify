import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { Bell, Send, Clock, CheckCircle2, XCircle, Users, BookOpen, Loader2 } from "lucide-react";
import { getCampaigns } from "@/lib/notifications/actions";
import NovaCampanhaForm from "./NovaCampanhaForm";
import { DeleteButton, CancelButton, SendNowButton } from "./CampaignActions";

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (p?.role !== "admin") redirect("/dashboard");
}

const STATUS_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft:     { label: "Rascunho",  color: "#2D2D2D", icon: Bell },
  scheduled: { label: "Agendada",  color: "#FEC649", icon: Clock },
  sending:   { label: "Enviando",  color: "#6699F3", icon: Loader2 },
  sent:      { label: "Enviada",   color: "#72CF92", icon: CheckCircle2 },
  cancelled: { label: "Cancelada", color: "#9ca3af", icon: XCircle },
};

function targetLabel(target: string) {
  if (target === "all") return "Todas as alunas";
  if (target.startsWith("course:")) return "Matriculadas no curso";
  return target;
}

export default async function NotificacoesAdminPage() {
  await assertAdmin();
  const service = createServiceClient();

  const [campaigns, { data: courses }] = await Promise.all([
    getCampaigns(),
    service.from("courses").select("id, title").eq("published", true).order("title"),
  ]);

  const totalEnviadas = campaigns.filter((c) => c.status === "sent").length;
  const totalAgendadas = campaigns.filter((c) => c.status === "scheduled").length;
  const totalEnviados = campaigns.reduce((s, c) => s + (c.sent_count ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Topo */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Notificações</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crie e gerencie notificações para as alunas.
          </p>
        </div>
        <NovaCampanhaForm courses={courses ?? []} />
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCard label="Campanhas enviadas" value={totalEnviadas} icon={CheckCircle2} color="#72CF92" />
        <SummaryCard label="Agendadas" value={totalAgendadas} icon={Clock} color="#FEC649" />
        <SummaryCard label="Total campanhas" value={campaigns.length} icon={Bell} color="#6699F3" />
        <SummaryCard label="Notificações criadas" value={totalEnviados} icon={Send} color="#6699F3" />
      </div>

      {/* Lista de campanhas */}
      <div className="handify-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-sm">Histórico de campanhas</h2>
        </div>

        {campaigns.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground">
            Nenhuma campanha criada ainda.
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {campaigns.map((c) => {
              const meta = STATUS_META[c.status] ?? STATUS_META.draft;
              const Icon = meta.icon;
              const isTargetAll = c.target === "all";

              return (
                <div key={c.id} className="px-6 py-4 flex items-start gap-4">
                  {/* Ícone status */}
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: meta.color + "18" }}>
                    <Icon className="w-4 h-4" style={{ color: meta.color }} />
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">{c.title}</p>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ background: meta.color + "18", color: meta.color }}>
                        {meta.label}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{c.body}</p>

                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        {isTargetAll ? <Users className="w-3 h-3" /> : <BookOpen className="w-3 h-3" />}
                        {targetLabel(c.target)}
                      </span>
                      {c.scheduled_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(c.scheduled_at).toLocaleString("pt-BR", {
                            day: "2-digit", month: "2-digit", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </span>
                      )}
                      {c.status === "sent" && (
                        <span className="flex items-center gap-1">
                          <Send className="w-3 h-3" />
                          {c.sent_count} enviadas ·{" "}
                          {new Date(c.sent_at!).toLocaleString("pt-BR", {
                            day: "2-digit", month: "2-digit",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-1 shrink-0">
                    {c.status === "scheduled" && (
                      <>
                        <SendNowButton id={c.id} />
                        <CancelButton id={c.id} />
                      </>
                    )}
                    {(c.status === "draft" || c.status === "cancelled" || c.status === "sent") && (
                      <DeleteButton id={c.id} />
                    )}
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

function SummaryCard({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: React.ElementType; color: string;
}) {
  return (
    <div className="handify-card p-5">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: color + "20" }}>
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
