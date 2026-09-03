"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import {
  ShieldOff,
  Shield,
  BookOpen,
  Award,
  ClipboardList,
  ExternalLink,
  Plus,
  Minus,
  Mail,
  Pencil,
  CheckCircle2,
  Phone,
  Calendar,
  CreditCard,
  UserCircle,
  Bell,
  BellOff,
  ShoppingBag,
  X,
  NotebookPen,
  Save,
  Search,
  RefreshCw,
  Check,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  grantAccessAction,
  revokeAccessAction,
  toggleBanAction,
  updateProfileAction,
  grantMultipleAccessAction,
  resendAccessEmailAction,
  setStudentPasswordAction,
} from "./actions";
import { grantMembershipAction, revokeMembershipAction } from "./membership-actions";
import { useModalBackGuard } from "@/hooks/useModalBackGuard";
import ActivityTab, { type ActivityItem } from "@/components/admin/alunos/ActivityTab";

type CourseEntry = {
  id: string;
  title: string;
  thumbnail_url: string | null;
  slug: string;
  enrollment: {
    id: string;
    source: string;
    granted_at: string;
    expires_at: string | null;
    progress: { total: number; completed: number } | null;
  } | null;
};

type Certificate = {
  id: string;
  verify_hash: string;
  issued_at: string;
  course: { title: string } | null;
};

type AuditEntry = {
  id: string;
  action: string;
  meta: Record<string, unknown>;
  created_at: string;
  admin: { full_name: string | null } | null;
};

type PaytEnrollment = {
  id: string;
  course_title: string | null;
  granted_at: string;
  expires_at: string | null;
};

/** Uma linha de `memberships` (plan = completo). Ativa = sem revoked_at e não vencida. */
type Membership = {
  id: string;
  source: string;
  granted_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  reason: string | null;
  granted_by_name: string | null;
};

function membershipAtiva(m: Membership): boolean {
  return !m.revoked_at && (!m.expires_at || new Date(m.expires_at) > new Date());
}

interface Props {
  profile: {
    id: string;
    full_name: string | null;
    email: string | null;
    banned: boolean;
    created_at: string;
    phone: string | null;
    date_of_birth: string | null;
    admin_notes: string | null;
    cpf_masked: string | null;
    hasPushEnabled: boolean;
  };
  courses: CourseEntry[];
  certificates: Certificate[];
  auditLog: AuditEntry[];
  activity: ActivityItem[];
  paytEnrollments: PaytEnrollment[];
  memberships: Membership[];
  defaultTab?: "perfil" | "atividade";
}

const ACTION_LABELS: Record<string, string> = {
  grant_access: "Acesso concedido",
  revoke_access: "Acesso revogado",
  "enrollment.revoked": "Acesso revogado (webhook)",
  "membership.granted": "Handify Completo concedido",
  "membership.revoked": "Handify Completo revogado",
  ban: "Aluna banida",
  unban: "Ban removido",
  update_email: "E-mail atualizado",
  set_password: "Senha definida pelo admin",
  reject_forum_post: "Post do fórum rejeitado",
  delete_forum_post: "Post do fórum deletado",
};

export default function AlunaDetail({ profile, courses, certificates, auditLog, activity, paytEnrollments, memberships, defaultTab = "perfil" }: Props) {
  const initial = profile.full_name?.charAt(0)?.toUpperCase() ?? "?";
  const temCompleto = memberships.some(membershipAtiva);
  const [activeTab, setActiveTab] = useState<"perfil" | "atividade">(defaultTab);
  const [banPending, startBanTransition] = useTransition();
  const [banned, setBanned] = useState(profile.banned);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileState, profileAction, profilePending] = useActionState(updateProfileAction, {});
  useModalBackGuard(editingProfile, () => setEditingProfile(false));

  const [setPasswordOpen, setSetPasswordOpen] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordResult, setPasswordResult] = useState<"success" | "error" | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordPending, startPasswordTransition] = useTransition();
  useModalBackGuard(setPasswordOpen, () => setSetPasswordOpen(false));

  function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (passwordValue.length < 8) {
      setPasswordError("A senha deve ter no mínimo 8 caracteres.");
      return;
    }
    if (passwordValue !== passwordConfirm) {
      setPasswordError("As senhas não coincidem.");
      return;
    }
    setPasswordError(null);
    startPasswordTransition(async () => {
      const res = await setStudentPasswordAction(profile.id, passwordValue);
      if (res.error) {
        setPasswordError(res.error);
      } else {
        setPasswordResult("success");
        setTimeout(() => {
          setSetPasswordOpen(false);
          setPasswordResult(null);
          setPasswordValue("");
          setPasswordConfirm("");
        }, 2000);
      }
    });
  }

  const [resendEmailPending, startResendEmailTransition] = useTransition();
  const [resendEmailResult, setResendEmailResult] = useState<"sent" | "error" | null>(null);

  function handleResendAccessEmail() {
    startResendEmailTransition(async () => {
      setResendEmailResult(null);
      const res = await resendAccessEmailAction(profile.id);
      setResendEmailResult(res.error ? "error" : "sent");
      setTimeout(() => setResendEmailResult(null), 4000);
    });
  }

  const [courseSearch, setCourseSearch] = useState("");
  const searchLower = courseSearch.toLowerCase();
  const enrolledCourses = courses.filter(
    (c) => c.enrollment !== null && c.title.toLowerCase().includes(searchLower)
  );
  const unenrolledCourses = courses.filter(
    (c) => c.enrollment === null && c.title.toLowerCase().includes(searchLower)
  );
  const enrolledCount = courses.filter((c) => c.enrollment !== null).length;
  const [showUnenrolled, setShowUnenrolled] = useState(false);

  function handleToggleBan() {
    const next = !banned;
    const msg = next
      ? `Banir ${profile.full_name ?? "esta aluna"}? Ela não poderá acessar a plataforma.`
      : `Remover o ban de ${profile.full_name ?? "esta aluna"}?`;
    if (!confirm(msg)) return;
    startBanTransition(async () => {
      const res = await toggleBanAction(profile.id, next);
      if (!res.error) setBanned(next);
      else alert(res.error);
    });
  }

  return (
    <div className="space-y-6">
      {/* Perfil header */}
      <div className="handify-card p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white shrink-0"
          style={{ background: "#6699F3" }}
        >
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">
            {profile.full_name ?? "Sem nome"}
          </h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Mail className="w-3.5 h-3.5" />
            {profile.email ?? "—"}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
          {resendEmailResult === "sent" && (
            <span className="flex items-center gap-1 text-xs text-[#72CF92] font-medium">
              <Check className="w-3.5 h-3.5" /> E-mail enviado
            </span>
          )}
          {resendEmailResult === "error" && (
            <span className="text-xs text-red-500">Erro ao enviar</span>
          )}
          <button
            onClick={handleResendAccessEmail}
            disabled={resendEmailPending}
            title="Enviar e-mail com instruções de acesso"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-[#6699F3]/40 text-[#6699F3] hover:bg-[#6699F3]/10 disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", resendEmailPending && "animate-spin")} />
            {resendEmailPending ? "Enviando…" : "Reenviar acesso"}
          </button>
          <button
            onClick={() => { setSetPasswordOpen(true); setPasswordResult(null); setPasswordError(null); setPasswordValue(""); setPasswordConfirm(""); }}
            title="Definir senha para esta aluna"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-border text-muted-foreground hover:text-foreground hover:border-[#6699F3]/40"
          >
            <KeyRound className="w-3.5 h-3.5" />
            Definir senha
          </button>
          {temCompleto && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#6699F3]/10 text-[#6699F3] text-xs font-semibold"
              title="Tem o Handify Completo ativo"
            >
              <Sparkles className="w-3 h-3" />
              Handify Completo
            </span>
          )}
          {banned && (
            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-xs font-semibold">
              Banida
            </span>
          )}
          <button
            onClick={handleToggleBan}
            disabled={banPending}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border",
              banned
                ? "border-[#72CF92] text-[#5bb577] hover:bg-[#72CF92]/10"
                : "border-red-300 text-red-600 hover:bg-red-50"
            )}
          >
            {banned ? (
              <><Shield className="w-3.5 h-3.5" /> Remover ban</>
            ) : (
              <><ShieldOff className="w-3.5 h-3.5" /> Banir</>
            )}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex gap-1 -mb-px">
          {(["perfil", "atividade"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize",
                activeTab === t
                  ? "border-[#6699F3] text-[#6699F3]"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              {t === "perfil" ? "Perfil" : `Atividade${activity.length > 0 ? ` (${activity.length})` : ""}`}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "atividade" && (
        <div className="handify-card p-5">
          <ActivityTab items={activity} />
        </div>
      )}

      {activeTab === "perfil" && <>
      {/* Dados cadastrais */}
      <div className="handify-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <UserCircle className="w-4 h-4" />
            Dados cadastrais
          </h2>
          <button
            onClick={() => setEditingProfile(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-[#6699F3]/40 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Editar
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> E-mail
            </p>
            <p className="text-sm font-medium break-all">{profile.email ?? "—"}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" /> Telefone
            </p>
            <p className="text-sm font-medium">{profile.phone ?? <span className="text-muted-foreground/50">Não informado</span>}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Nascimento
            </p>
            <p className="text-sm font-medium">
              {profile.date_of_birth
                ? new Date(profile.date_of_birth + "T12:00:00").toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
                : <span className="text-muted-foreground/50">Não informado</span>}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" /> CPF
            </p>
            <p className="text-sm font-medium font-mono">
              {profile.cpf_masked ?? <span className="text-muted-foreground/50">Não informado</span>}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5" /> Push
            </p>
            {profile.hasPushEnabled ? (
              <p className="text-sm font-medium flex items-center gap-1 text-[#72CF92]">
                <Bell className="w-3.5 h-3.5" /> Ativa
              </p>
            ) : (
              <p className="text-sm font-medium flex items-center gap-1 text-muted-foreground/60">
                <BellOff className="w-3.5 h-3.5" /> Inativa
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-border/40">
          <p className="text-xs text-muted-foreground">
            Membro desde{" "}
            <span className="font-medium text-foreground">
              {new Date(profile.created_at).toLocaleDateString("pt-BR", {
                day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo",
              })}
            </span>
          </p>
        </div>
      </div>

      {/* Anotações admin */}
      <div className="handify-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <NotebookPen className="w-4 h-4" />
            Anotações internas
          </h2>
          <button
            onClick={() => setEditingProfile(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-[#6699F3]/40 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Editar
          </button>
        </div>
        {profile.admin_notes ? (
          <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
            {profile.admin_notes}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground/50 italic">
            Nenhuma anotação. Use para registrar observações internas sobre esta aluna — visível apenas para admins.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna principal — cursos */}
        <div className="lg:col-span-2">
          <section className="handify-card overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-border/60 space-y-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#6699F3]" />
                <h2 className="font-semibold">Cursos</h2>
                <span className="text-xs text-muted-foreground">
                  {enrolledCount} matrícula{enrolledCount !== 1 ? "s" : ""} · {courses.length} disponíveis
                </span>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Pesquisar curso…"
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                  className="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg border border-border bg-muted/30 focus:outline-none focus:ring-1 focus:ring-[#6699F3]/50 focus:bg-white"
                />
                {courseSearch && (
                  <button
                    onClick={() => setCourseSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* ── Com acesso ── */}
            {enrolledCourses.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-muted-foreground">
                Nenhuma matrícula ativa.
              </div>
            ) : (
              <>
                <div className="px-5 py-2 bg-[#72CF92]/5 border-b border-[#72CF92]/20">
                  <p className="text-xs font-semibold text-[#5bb577] uppercase tracking-wide">
                    ✓ Com acesso ({enrolledCount})
                  </p>
                </div>
                <div className="divide-y divide-border/40">
                  {enrolledCourses.map((course) => (
                    <CourseRow key={course.id} course={course} userId={profile.id} />
                  ))}
                </div>
              </>
            )}

            {/* ── Sem acesso (colapsável) ── */}
            {unenrolledCourses.length > 0 && (
              <>
                <button
                  onClick={() => setShowUnenrolled((v) => !v)}
                  className="w-full px-5 py-3 flex items-center gap-2 bg-muted/30 hover:bg-muted/50 transition-colors border-t border-border/60"
                >
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    🔒 Sem acesso ({unenrolledCourses.length})
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {showUnenrolled ? "Recolher" : "Ver cursos disponíveis"}
                  </span>
                </button>
                {showUnenrolled && (
                  <div className="divide-y divide-border/40">
                    {unenrolledCourses.map((course) => (
                      <CourseRow key={course.id} course={course} userId={profile.id} />
                    ))}
                  </div>
                )}
              </>
            )}
          </section>

          {/* Handify Completo */}
          <MembershipSection userId={profile.id} memberships={memberships} />

          {/* Acesso em lote */}
          {unenrolledCourses.length > 0 && (
            <BulkGrantSection
              userId={profile.id}
              unenrolledCourses={unenrolledCourses}
            />
          )}
        </div>

        {/* Coluna lateral */}
        <div className="space-y-6">
          {/* Certificados */}
          <section className="handify-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border/60 flex items-center gap-2">
              <Award className="w-4 h-4 text-[#FEC649]" />
              <h2 className="font-semibold">
                Certificados{" "}
                <span className="text-muted-foreground font-normal text-sm">
                  ({certificates.length})
                </span>
              </h2>
            </div>
            {certificates.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground text-sm">
                Nenhum certificado.
              </div>
            ) : (
              <ul className="divide-y divide-border/40">
                {certificates.map((c) => (
                  <li key={c.id} className="px-5 py-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium line-clamp-1">
                        {c.course?.title ?? "Curso"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(c.issued_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                      </p>
                    </div>
                    <Link
                      href={`/verificar/${c.verify_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#6699F3] hover:text-[#5580d4]"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Compras via Payt — uma linha por curso (inclui order bumps e upsells) */}
          <section className="handify-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border/60 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#6699F3]" />
              <h2 className="font-semibold">
                Compras{" "}
                <span className="text-muted-foreground font-normal text-sm">
                  ({paytEnrollments.filter((e) => !e.expires_at || new Date(e.expires_at) > new Date()).length})
                </span>
              </h2>
            </div>
            {paytEnrollments.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground text-sm">
                Nenhuma compra registrada.
              </div>
            ) : (
              <ul className="divide-y divide-border/40">
                {paytEnrollments.map((e) => {
                  const revoked = !!e.expires_at && new Date(e.expires_at) <= new Date();
                  return (
                    <li key={e.id} className="px-5 py-3 space-y-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium line-clamp-1 flex-1 min-w-0">
                          {e.course_title ?? "Curso não identificado"}
                        </p>
                        {revoked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-500/15 text-red-600 shrink-0">
                            Revogado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#72CF92]/15 text-[#3d9e5a] shrink-0">
                            Ativo
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(e.granted_at).toLocaleString("pt-BR", {
                          day: "2-digit", month: "2-digit", year: "numeric",
                          hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
                        })}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Auditoria */}
          {auditLog.length > 0 && (
            <section className="handify-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border/60 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-muted-foreground" />
                <h2 className="font-semibold text-sm">Histórico de ações</h2>
              </div>
              <ul className="divide-y divide-border/40">
                {auditLog.map((entry) => (
                  <li key={entry.id} className="px-5 py-3 space-y-0.5">
                    <p className="text-xs font-medium">
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </p>
                    {typeof entry.meta?.reason === "string" && (
                      <p className="text-xs text-muted-foreground">
                        Motivo: {entry.meta.reason}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      {entry.admin?.full_name ?? "Admin"} ·{" "}
                      {new Date(entry.created_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "America/Sao_Paulo",
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
      </>}

      {/* Modal de definir senha */}
      {setPasswordOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={() => setSetPasswordOpen(false)}
        >
          <div
            className="handify-card w-full max-w-sm flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
              <KeyRound className="w-5 h-5 text-[#6699F3]" />
              <h2 className="font-semibold flex-1">Definir senha</h2>
              <button
                onClick={() => setSetPasswordOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSetPassword} className="px-5 py-5 space-y-4">
              <p className="text-xs text-muted-foreground">
                Define uma nova senha para <span className="font-medium text-foreground">{profile.full_name ?? profile.email}</span>. A aluna poderá fazer login imediatamente.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Nova senha
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={passwordValue}
                    onChange={(e) => setPasswordValue(e.target.value)}
                    required
                    minLength={8}
                    autoFocus
                    placeholder="Mínimo 8 caracteres"
                    className="w-full px-3 py-2 pr-10 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Confirmar senha
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required
                  placeholder="Repita a senha"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30"
                />
              </div>

              {passwordError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                  {passwordError}
                </div>
              )}
              {passwordResult === "success" && (
                <div className="rounded-lg bg-[#72CF92]/10 border border-[#72CF92]/30 px-4 py-3 text-sm text-[#3d9e5a] flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  Senha definida com sucesso!
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSetPasswordOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={passwordPending || passwordResult === "success"}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-[#6699F3] text-white hover:bg-[#5580d4] transition-colors disabled:opacity-50"
                >
                  <KeyRound className="w-4 h-4" />
                  {passwordPending ? "Salvando…" : "Definir senha"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de edição de perfil */}
      {editingProfile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={() => setEditingProfile(false)}
        >
          <div
            className="handify-card w-full max-w-lg flex flex-col overflow-hidden"
            style={{ maxHeight: "90vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
              <UserCircle className="w-5 h-5 text-[#6699F3]" />
              <h2 className="font-semibold flex-1">Editar perfil</h2>
              <button
                onClick={() => setEditingProfile(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Formulário */}
            <form action={profileAction} className="overflow-y-auto flex-1">
              <input type="hidden" name="user_id" value={profile.id} />

              <div className="px-5 py-5 space-y-4">
                {/* Nome */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Nome completo
                  </label>
                  <input
                    name="full_name"
                    required
                    defaultValue={profile.full_name ?? ""}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30"
                    placeholder="Nome da aluna"
                  />
                </div>

                {/* Telefone + Nascimento em grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Telefone / WhatsApp
                    </label>
                    <input
                      name="phone"
                      type="tel"
                      defaultValue={profile.phone ?? ""}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30"
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Data de nascimento
                    </label>
                    <input
                      name="date_of_birth"
                      type="date"
                      defaultValue={profile.date_of_birth ?? ""}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30"
                    />
                  </div>
                </div>

                {/* E-mail */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Mail className="w-3 h-3" /> E-mail
                  </label>
                  <input
                    name="email"
                    type="email"
                    required
                    defaultValue={profile.email ?? ""}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30"
                    placeholder="email@exemplo.com"
                  />
                </div>

                {/* CPF */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <CreditCard className="w-3 h-3" /> CPF
                  </label>
                  <input
                    name="cpf"
                    type="text"
                    inputMode="numeric"
                    maxLength={14}
                    defaultValue=""
                    placeholder={profile.cpf_masked ?? "000.000.000-00"}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {profile.cpf_masked
                      ? `Atual: ${profile.cpf_masked} · deixe em branco para manter`
                      : "Deixe em branco para não alterar · armazenado criptografado"}
                  </p>
                </div>

                {/* Anotações admin */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <NotebookPen className="w-3 h-3" /> Anotações internas
                    <span className="normal-case font-normal text-muted-foreground/60 ml-1">— visível apenas para admins</span>
                  </label>
                  <textarea
                    name="admin_notes"
                    rows={4}
                    defaultValue={profile.admin_notes ?? ""}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30 resize-none"
                    placeholder="Ex: cliente solicitou reembolso em jun/24, potencial para curso avançado de sabonetes…"
                  />
                </div>

                {/* Feedback */}
                {profileState.error && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                    {profileState.error}
                  </div>
                )}
                {profileState.success && (
                  <div className="rounded-lg bg-[#72CF92]/10 border border-[#72CF92]/30 px-4 py-3 text-sm text-[#3d9e5a]">
                    {profileState.success}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingProfile(false)}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={profilePending}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-[#6699F3] text-white hover:bg-[#5580d4] transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {profilePending ? "Salvando…" : "Salvar alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Acesso em lote ───────────────────────────────────────────────────────────

// ─── Handify Completo ─────────────────────────────────────────────────────────
const MEMBERSHIP_SOURCE_LABEL: Record<string, string> = {
  payt: "Payt",
  kiwify: "Kiwify",
  manual: "Manual",
  bonus: "Bônus",
  migration: "Migração",
};

function dataBR(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

/**
 * Status do plano + Dar/Revogar. Antes "dar o Completo" era marcar 23 checkboxes
 * em "Dar acesso em lote", e o sistema seguia sem saber que a aluna tinha o
 * plano. Agora a membership é a fonte da verdade e as matrículas são consequência
 * (ver membership-actions.ts).
 */
function MembershipSection({ userId, memberships }: { userId: string; memberships: Membership[] }) {
  const ativa = memberships.find(membershipAtiva) ?? null;
  const historico = memberships.filter((m) => m !== ativa);
  const [mode, setMode] = useState<"idle" | "granting" | "revoking">("idle");
  const [showHistory, setShowHistory] = useState(false);
  const [grantState, grantAction, grantPending] = useActionState(grantMembershipAction, {});
  const [revokeState, revokeAction, revokePending] = useActionState(revokeMembershipAction, {});
  const feedback = grantState.error || grantState.success || revokeState.error || revokeState.success;
  const feedbackIsError = !!(grantState.error || revokeState.error);

  return (
    <section className="handify-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border/60 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-[#6699F3]" />
        <span className="font-semibold text-sm">Handify Completo</span>
        <span
          className={cn(
            "ml-auto px-2 py-0.5 rounded-full text-xs font-semibold",
            ativa ? "bg-[#72CF92]/15 text-[#3d9e5a]" : "bg-muted text-muted-foreground"
          )}
        >
          {ativa
            ? ativa.expires_at
              ? `Ativo até ${dataBR(ativa.expires_at)}`
              : "Ativo"
            : "Não tem"}
        </span>
      </div>

      <div className="p-5 space-y-4">
        {ativa ? (
          <div className="text-sm space-y-1">
            <p className="text-foreground">
              Desde <strong>{dataBR(ativa.granted_at)}</strong> · origem{" "}
              <strong>{MEMBERSHIP_SOURCE_LABEL[ativa.source] ?? ativa.source}</strong>
              {ativa.granted_by_name && <> · por {ativa.granted_by_name}</>}
            </p>
            {ativa.reason && <p className="text-muted-foreground text-xs">{ativa.reason}</p>}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Esta aluna não tem o plano. Dar o Completo libera todos os cursos do plano de uma
            vez e registra que ela é aluna Completo — o que 23 acessos avulsos não fazem.
          </p>
        )}

        {mode === "idle" && (
          <div className="flex flex-wrap gap-2">
            {ativa ? (
              <button
                onClick={() => setMode("revoking")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-red-300 text-red-600 hover:bg-red-50 transition-colors min-h-[40px]"
              >
                <Minus className="w-3.5 h-3.5" />
                Revogar Handify Completo
              </button>
            ) : (
              <button
                onClick={() => setMode("granting")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-[#6699F3] text-white hover:bg-[#5580d4] transition-colors min-h-[40px]"
              >
                <Plus className="w-3.5 h-3.5" />
                Dar Handify Completo
              </button>
            )}
            {historico.length > 0 && (
              <button
                onClick={() => setShowHistory((v) => !v)}
                className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[40px]"
              >
                {showHistory ? "Esconder histórico" : `Histórico (${historico.length})`}
              </button>
            )}
          </div>
        )}

        {mode === "granting" && (
          <form action={grantAction} className="space-y-3 rounded-lg bg-muted/40 p-4">
            <input type="hidden" name="user_id" value={userId} />
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-muted-foreground">
                Origem
                <select
                  name="source"
                  defaultValue="manual"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="manual">Manual (erro de disparo, acordo)</option>
                  <option value="bonus">Bônus (presente, campanha)</option>
                </select>
              </label>
              <label className="block text-xs font-medium text-muted-foreground">
                Validade (opcional)
                <input
                  type="date"
                  name="expires_at"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
            </div>
            <label className="block text-xs font-medium text-muted-foreground">
              Motivo
              <input
                name="reason"
                required
                placeholder="Ex.: pagou na Payt em 02/09, webhook não chegou"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={grantPending}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#6699F3] text-white hover:bg-[#5580d4] disabled:opacity-60 transition-colors min-h-[40px]"
              >
                {grantPending ? "Liberando…" : "Confirmar"}
              </button>
              <button
                type="button"
                onClick={() => setMode("idle")}
                className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground min-h-[40px]"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {mode === "revoking" && ativa && (
          <form action={revokeAction} className="space-y-3 rounded-lg bg-red-50 p-4">
            <input type="hidden" name="user_id" value={userId} />
            <input type="hidden" name="membership_id" value={ativa.id} />
            <p className="text-xs text-red-700">
              Encerra o plano e os cursos que vieram junto com ele. Cursos que a aluna comprou
              separado continuam.
            </p>
            <label className="block text-xs font-medium text-red-700">
              Motivo
              <input
                name="reason"
                required
                placeholder="Ex.: reembolso acordado em 03/09"
                className="mt-1 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={revokePending}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 transition-colors min-h-[40px]"
              >
                {revokePending ? "Revogando…" : "Revogar"}
              </button>
              <button
                type="button"
                onClick={() => setMode("idle")}
                className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground min-h-[40px]"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {feedback && (
          <p className={cn("text-sm", feedbackIsError ? "text-red-600" : "text-[#3d9e5a]")}>{feedback}</p>
        )}

        {showHistory && historico.length > 0 && (
          <ul className="space-y-1.5 text-xs text-muted-foreground border-t border-border/60 pt-3">
            {historico.map((m) => (
              <li key={m.id}>
                {dataBR(m.granted_at)} → {m.revoked_at ? `revogado em ${dataBR(m.revoked_at)}` : m.expires_at ? `venceu em ${dataBR(m.expires_at)}` : "—"}
                {" · "}
                {MEMBERSHIP_SOURCE_LABEL[m.source] ?? m.source}
                {m.reason && <> · {m.reason}</>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function BulkGrantSection({
  userId,
  unenrolledCourses,
}: {
  userId: string;
  unenrolledCourses: CourseEntry[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkSearch, setBulkSearch] = useState("");
  const [state, action, pending] = useActionState(grantMultipleAccessAction, {});

  const visibleCourses = bulkSearch
    ? unenrolledCourses.filter((c) => c.title.toLowerCase().includes(bulkSearch.toLowerCase()))
    : unenrolledCourses;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(unenrolledCourses.map((c) => c.id)));
  }

  function clearAll() {
    setSelected(new Set());
  }

  return (
    <section className="handify-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-4 flex items-center gap-2 hover:bg-muted/30 transition-colors text-left"
      >
        <Plus className="w-4 h-4 text-[#6699F3]" />
        <span className="font-semibold text-sm">Dar acesso em lote</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {open ? "Recolher" : `${unenrolledCourses.length} curso${unenrolledCourses.length !== 1 ? "s" : ""} sem acesso`}
        </span>
      </button>

      {open && (
        <div className="border-t border-border/60">
          <form action={action} className="p-5 space-y-4">
            <input type="hidden" name="user_id" value={userId} />

            {/* Checkboxes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Selecionar cursos
                </p>
                <div className="flex gap-3 text-xs text-[#6699F3]">
                  <button type="button" onClick={selectAll} className="hover:underline">
                    Todos
                  </button>
                  <button type="button" onClick={clearAll} className="hover:underline">
                    Nenhum
                  </button>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Pesquisar curso…"
                  value={bulkSearch}
                  onChange={(e) => setBulkSearch(e.target.value)}
                  className="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg border border-border bg-muted/30 focus:outline-none focus:ring-1 focus:ring-[#6699F3]/50 focus:bg-white"
                />
                {bulkSearch && (
                  <button
                    type="button"
                    onClick={() => setBulkSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {visibleCourses.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">Nenhum curso encontrado.</p>
                )}
                {visibleCourses.map((course) => (
                  <label
                    key={course.id}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm",
                      selected.has(course.id)
                        ? "bg-[#6699F3]/10 border border-[#6699F3]/30"
                        : "bg-muted/30 border border-transparent hover:bg-muted/50"
                    )}
                  >
                    <input
                      type="checkbox"
                      name="course_id"
                      value={course.id}
                      checked={selected.has(course.id)}
                      onChange={() => toggle(course.id)}
                      className="accent-[#6699F3] w-4 h-4 shrink-0"
                    />
                    <span className="truncate">{course.title}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Motivo + Expiração */}
            <div className="flex gap-2 flex-wrap items-end">
              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <label className="text-[10px] text-muted-foreground leading-none">Motivo (obrigatório)</label>
                <input
                  name="reason"
                  required
                  placeholder="Ex.: cortesia, pacote especial…"
                  className="text-xs px-2.5 py-1.5 rounded border border-border bg-white focus:outline-none focus:ring-1 focus:ring-[#6699F3]/50"
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] text-muted-foreground leading-none">Expiração (opcional)</label>
                <input
                  name="expires_at"
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  className="text-xs px-2.5 py-1.5 rounded border border-border bg-white focus:outline-none focus:ring-1 focus:ring-[#6699F3]/50 w-36"
                />
              </div>
            </div>

            {/* Feedback */}
            {state.error && (
              <p className="text-xs text-red-600">{state.error}</p>
            )}
            {state.success && (
              <p className="text-xs text-green-600">{state.success}</p>
            )}

            {/* Ações */}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pending || selected.size === 0}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-[#6699F3] hover:bg-[#5580d4] rounded-md transition-colors disabled:opacity-50"
              >
                {pending
                  ? "Salvando…"
                  : `Dar acesso a ${selected.size} curso${selected.size !== 1 ? "s" : ""}`}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

// ─── Linha de curso com add/remove ────────────────────────────────────────────

function CourseRow({ course, userId }: { course: CourseEntry; userId: string }) {
  const [mode, setMode] = useState<"idle" | "adding" | "removing">("idle");
  const [grantState, grantAction, grantPending] = useActionState(grantAccessAction, {});
  const [revokeState, revokeAction, revokePending] = useActionState(revokeAccessAction, {});

  const e = course.enrollment;
  const pct =
    e?.progress && e.progress.total > 0
      ? Math.round((e.progress.completed / e.progress.total) * 100)
      : null;
  const isExpired = e?.expires_at ? new Date(e.expires_at) < new Date() : false;

  return (
    <div className="px-5 py-3 space-y-2">
      <div className="flex items-center gap-3">
        {/* Thumbnail */}
        {course.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.thumbnail_url}
            alt={course.title}
            className="w-10 h-10 rounded object-cover shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded bg-[#6699F3]/10 flex items-center justify-center text-lg shrink-0">
            🎨
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{course.title}</p>
          {e ? (
            <p className="text-xs text-muted-foreground">
              {sourceLabel(e.source)} · {new Date(e.granted_at).toLocaleDateString("pt-BR")}
              {e.expires_at && (
                <span className={cn("ml-1", isExpired ? "text-red-500" : "")}>
                  · {isExpired ? "Expirou" : "Expira"}{" "}
                  {new Date(e.expires_at).toLocaleDateString("pt-BR")}
                </span>
              )}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground/60">Sem matrícula</p>
          )}
        </div>

        {/* Status + ação */}
        <div className="flex items-center gap-2 shrink-0">
          {e ? (
            <>
              {pct !== null && (
                <span
                  className="text-xs font-semibold"
                  style={{ color: pct === 100 ? "#72CF92" : "#6699F3" }}
                >
                  {pct}%
                </span>
              )}
              <CheckCircle2 className="w-4 h-4 text-[#72CF92]" />
              <button
                onClick={() => setMode(mode === "removing" ? "idle" : "removing")}
                className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Remover acesso"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setMode(mode === "adding" ? "idle" : "adding")}
              className="p-1.5 rounded-lg text-[#6699F3] hover:bg-[#6699F3]/10 transition-colors"
              title="Dar acesso"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {e && pct !== null && (
        <div className="h-1 bg-muted rounded-full overflow-hidden ml-13">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              background: pct === 100 ? "#72CF92" : "#6699F3",
            }}
          />
        </div>
      )}

      {/* Formulário: dar acesso */}
      {mode === "adding" && (
        <form
          action={grantAction}
          className="bg-[#6699F3]/5 border border-[#6699F3]/20 rounded-lg p-3 space-y-2 ml-13"
        >
          <input type="hidden" name="user_id" value={userId} />
          <input type="hidden" name="course_id" value={course.id} />
          {grantState.error && (
            <p className="text-xs text-red-600">{grantState.error}</p>
          )}
          {grantState.success && (
            <p className="text-xs text-green-600">{grantState.success}</p>
          )}
          <div className="flex gap-2 flex-wrap items-end">
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <label className="text-[10px] text-muted-foreground leading-none">Motivo</label>
              <input
                name="reason"
                required
                placeholder="Motivo (obrigatório)"
                className="text-xs px-2.5 py-1.5 rounded border border-border bg-white focus:outline-none focus:ring-1 focus:ring-[#6699F3]/50"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] text-muted-foreground leading-none">Expiração (opcional)</label>
              <input
                name="expires_at"
                type="date"
                min={new Date().toISOString().split("T")[0]}
                className="text-xs px-2.5 py-1.5 rounded border border-border bg-white focus:outline-none focus:ring-1 focus:ring-[#6699F3]/50 w-36"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={grantPending}
                className="px-3 py-1 text-xs font-semibold text-white bg-[#6699F3] hover:bg-[#5580d4] rounded-md transition-colors disabled:opacity-50"
              >
                {grantPending ? "Salvando…" : "Dar acesso"}
              </button>
              <button
                type="button"
                onClick={() => setMode("idle")}
                className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Formulário: revogar acesso */}
      {mode === "removing" && e && (
        <form
          action={revokeAction}
          className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2 ml-13"
        >
          <input type="hidden" name="user_id" value={userId} />
          <input type="hidden" name="enrollment_id" value={e.id} />
          <input type="hidden" name="course_id" value={course.id} />
          {revokeState.error && (
            <p className="text-xs text-red-600">{revokeState.error}</p>
          )}
          <div className="flex gap-2 flex-wrap">
            <input
              name="reason"
              required
              placeholder="Motivo da remoção (obrigatório)"
              className="flex-1 min-w-0 text-xs px-2.5 py-1.5 rounded border border-red-200 bg-white focus:outline-none focus:ring-1 focus:ring-red-400"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={revokePending}
              className="px-3 py-1 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors disabled:opacity-50"
            >
              {revokePending ? "Removendo…" : "Confirmar remoção"}
            </button>
            <button
              type="button"
              onClick={() => setMode("idle")}
              className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}


function sourceLabel(source: string): string {
  switch (source) {
    case "manual": return "Manual";
    case "payt": return "Payt";
    case "subscription": return "Assinatura";
    default: return source;
  }
}
