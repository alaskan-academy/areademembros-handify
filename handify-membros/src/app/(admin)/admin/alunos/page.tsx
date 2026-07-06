import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Download,
  UserCircle,
  UserPlus,
  Phone,
  Calendar,
  TrendingUp,
  Users,
  UserCheck,
  UserX,
} from "lucide-react";
import { hashCpf, decryptCpf } from "@/lib/cpf-crypto";
import AlunosSearch from "./alunos-search";
import SemCadastroClient, { type SemCadastroRow } from "./SemCadastroClient";

const PAGE_SIZE = 25;
const GRANT_EVENT_TYPES = ["paid", "approved", "completed", "confirmed"];

function isCpf(q: string) {
  return q.replace(/\D/g, "").length === 11;
}
function formatCpfRaw(q: string) {
  return q.replace(/\D/g, "");
}

export default async function AlunosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; tab?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "admin") redirect("/dashboard");

  const { q: rawQ, page: rawPage, tab: rawTab } = await searchParams;
  const activeTab =
    rawTab === "sem-cadastro" ? "sem-cadastro" : "cadastradas";
  const q = rawQ?.trim() ?? "";
  const page = Math.max(1, parseInt(rawPage ?? "1"));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const service = createServiceClient();

  // ── Backfill cpf_hash (migração retroativa) ──────────────────────────────────
  {
    const { data: needsHash } = await service
      .from("profiles")
      .select("id, cpf_encrypted")
      .not("cpf_encrypted", "is", null)
      .is("cpf_hash", null);
    if (needsHash && needsHash.length > 0) {
      await Promise.all(
        (needsHash as { id: string; cpf_encrypted: string }[]).map(
          async (p) => {
            try {
              const digits = decryptCpf(p.cpf_encrypted).replace(/\D/g, "");
              await service
                .from("profiles")
                .update({ cpf_hash: hashCpf(digits) })
                .eq("id", p.id);
            } catch {
              // ignora falha de descriptografia
            }
          }
        )
      );
    }
  }

  // ── Dados para card de conversão (sempre) ─────────────────────────────────
  const [{ data: paidEvents }, { data: allProfileEmails }] = await Promise.all(
    [
      service
        .from("payment_events")
        .select("buyer_email")
        .eq("processed", true)
        .in("event_type", GRANT_EVENT_TYPES),
      service
        .from("profiles")
        .select("email")
        .neq("role", "admin"),
    ]
  );

  const uniqueBuyers = new Set(
    (paidEvents ?? [])
      .map((e) => e.buyer_email?.toLowerCase())
      .filter(Boolean) as string[]
  );
  const profileEmailSet = new Set(
    (allProfileEmails ?? [])
      .map((p) => p.email?.toLowerCase())
      .filter(Boolean) as string[]
  );
  const totalBuyers = uniqueBuyers.size;
  const withAccount = [...uniqueBuyers].filter((e) =>
    profileEmailSet.has(e)
  ).length;
  const pendingCount = totalBuyers - withAccount;
  const conversionRate =
    totalBuyers > 0 ? Math.round((withAccount / totalBuyers) * 100) : 0;

  // ── Dados "sem cadastro" ─────────────────────────────────────────────────────
  // Sempre busca para mostrar o badge no tab e calcular o card
  const { data: rawTokens } = await service
    .from("activation_tokens")
    .select(
      "id, email, buyer_name, buyer_phone, created_at, token, expires_at, courses(id, title, slug)"
    )
    .eq("used", false)
    .order("created_at", { ascending: false });

  const unregisteredTokens = (rawTokens ?? []).filter(
    (t) => !profileEmailSet.has(t.email.toLowerCase())
  );

  // Agrupa por email: uma linha por compradora, lista de cursos pendentes
  const byEmail = new Map<string, SemCadastroRow>();
  for (const t of unregisteredTokens) {
    const key = t.email.toLowerCase();
    const course = (
      t as unknown as { courses?: { id: string; title: string; slug: string } | null }
    ).courses;
    if (!byEmail.has(key)) {
      byEmail.set(key, {
        email: t.email,
        buyer_name: (t as { buyer_name?: string | null }).buyer_name ?? null,
        buyer_phone:
          (t as { buyer_phone?: string | null }).buyer_phone ?? null,
        created_at: t.created_at,
        courses: [],
      });
    }
    if (course) {
      byEmail.get(key)!.courses.push({
        id: course.id ?? null,
        title: course.title ?? null,
        slug: course.slug ?? null,
        token: t.token,
        expires_at: t.expires_at,
      });
    }
  }
  const semCadastro = Array.from(byEmail.values());
  const semCadastroCount = semCadastro.length;

  // ── Dados "cadastradas" (só no tab correspondente) ────────────────────────
  type ProfileRow = {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    date_of_birth: string | null;
    role: string;
    banned: boolean | null;
    created_at: string;
  };
  let profiles: ProfileRow[] = [];
  let count = 0;
  let cpfSearch = false;

  if (activeTab === "cadastradas") {
    if (q && isCpf(q)) {
      cpfSearch = true;
      const cpfDigits = formatCpfRaw(q);
      const cpfH = hashCpf(cpfDigits);

      const { data: byHash, count: hashCount } = await service
        .from("profiles")
        .select(
          "id, full_name, email, phone, date_of_birth, role, banned, created_at",
          { count: "exact" }
        )
        .eq("cpf_hash", cpfH)
        .neq("role", "admin");

      if ((byHash ?? []).length > 0) {
        profiles = (byHash ?? []) as ProfileRow[];
        count = hashCount ?? 0;
      } else {
        const { data: events } = await service
          .from("payment_events")
          .select("buyer_email")
          .filter("payload->customer->>doc", "eq", cpfDigits)
          .limit(10);
        const emails = [
          ...new Set(
            (events ?? []).map((e) => e.buyer_email).filter(Boolean)
          ),
        ];
        if (emails.length > 0) {
          const { data, count: c } = await service
            .from("profiles")
            .select(
              "id, full_name, email, phone, date_of_birth, role, banned, created_at",
              { count: "exact" }
            )
            .in("email", emails)
            .neq("role", "admin");
          profiles = (data ?? []) as ProfileRow[];
          count = c ?? 0;
        }
      }
    } else {
      let query = service
        .from("profiles")
        .select(
          "id, full_name, email, phone, date_of_birth, role, banned, created_at",
          { count: "exact" }
        )
        .neq("role", "admin")
        .order("created_at", { ascending: false })
        .range(from, to);
      if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
      const { data, count: c } = await query;
      profiles = (data ?? []) as ProfileRow[];
      count = c ?? 0;
    }
  }

  const profileIds = profiles.map((p) => p.id);
  const { data: enrollments } = profileIds.length
    ? await service
        .from("enrollments")
        .select("user_id")
        .in("user_id", profileIds)
    : { data: [] };
  const enrollCount: Record<string, number> = {};
  for (const e of enrollments ?? []) {
    enrollCount[e.user_id] = (enrollCount[e.user_id] ?? 0) + 1;
  }

  const totalPages =
    activeTab === "cadastradas" ? Math.ceil(count / PAGE_SIZE) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Alunas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie alunas e compradoras da plataforma
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/alunos/nova"
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-[#6699F3] text-white hover:bg-[#5580d4] transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Nova aluna
          </Link>
          <a
            href="/api/admin/alunos/export"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </a>
        </div>
      </div>

      {/* Card de conversão */}
      {totalBuyers > 0 && (
        <div className="handify-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-[#6699F3]" />
            <h2 className="text-sm font-semibold">
              Taxa de conversão compra → conta
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Total compraram */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Users className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{totalBuyers}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Compraram
              </p>
            </div>
            {/* Com conta */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <UserCheck className="w-4 h-4 text-[#72CF92]" />
              </div>
              <p className="text-2xl font-bold text-[#72CF92]">{withAccount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Criaram conta
              </p>
            </div>
            {/* Pendentes */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <UserX className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-2xl font-bold text-amber-500">{pendingCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Pendentes</p>
            </div>
            {/* Taxa */}
            <div className="text-center">
              <div className="mb-1 h-5" />
              <p className="text-2xl font-bold text-[#6699F3]">
                {conversionRate}%
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Taxa de ativação
              </p>
            </div>
          </div>
          {/* Barra de progresso */}
          <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${conversionRate}%`,
                background:
                  conversionRate >= 75
                    ? "#72CF92"
                    : conversionRate >= 50
                      ? "#6699F3"
                      : "#FEC649",
              }}
            />
          </div>
        </div>
      )}

      {/* Abas */}
      <div className="border-b border-border">
        <nav className="flex gap-1 -mb-px">
          <Link
            href="/admin/alunos?tab=cadastradas"
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "cadastradas"
                ? "border-[#6699F3] text-[#6699F3]"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <UserCheck className="w-4 h-4" />
            Cadastradas
            {activeTab === "cadastradas" && count > 0 && (
              <span className="ml-1 text-xs bg-[#6699F3]/15 text-[#6699F3] px-1.5 py-0.5 rounded-full font-semibold">
                {count}
              </span>
            )}
          </Link>
          <Link
            href="/admin/alunos?tab=sem-cadastro"
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "sem-cadastro"
                ? "border-amber-500 text-amber-600"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <UserX className="w-4 h-4" />
            Sem cadastro
            {semCadastroCount > 0 && (
              <span
                className={`ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  activeTab === "sem-cadastro"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {semCadastroCount}
              </span>
            )}
          </Link>
        </nav>
      </div>

      {/* Conteúdo do tab "Sem cadastro" */}
      {activeTab === "sem-cadastro" && (
        <SemCadastroClient rows={semCadastro} />
      )}

      {/* Conteúdo do tab "Cadastradas" */}
      {activeTab === "cadastradas" && (
        <>
          <AlunosSearch defaultValue={q} />
          {cpfSearch && (
            <p className="text-xs text-[#6699F3]">
              Buscando por CPF nos registros de compra.
            </p>
          )}

          <div className="handify-card overflow-hidden overflow-x-auto">
            {profiles.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <UserCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhuma aluna encontrada</p>
                {q && (
                  <p className="text-sm mt-1">
                    {cpfSearch
                      ? "CPF não encontrado nos registros."
                      : "Tente um termo diferente."}
                  </p>
                )}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-foreground/70">
                      Nome / E-mail
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground/70 hidden md:table-cell">
                      Telefone
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground/70 hidden lg:table-cell">
                      Nascimento
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-foreground/70 hidden xl:table-cell">
                      Cadastro
                    </th>
                    <th className="text-center px-4 py-3 font-semibold text-foreground/70 hidden sm:table-cell">
                      Matrículas
                    </th>
                    <th className="text-center px-4 py-3 font-semibold text-foreground/70">
                      Status
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {profiles.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                            style={{ background: "#6699F3" }}
                          >
                            {p.full_name?.charAt(0)?.toUpperCase() ?? "?"}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate max-w-[160px]">
                              {p.full_name ?? "—"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate max-w-[160px]">
                              {p.email ?? "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {p.phone ? (
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Phone className="w-3.5 h-3.5 shrink-0" />
                            {p.phone}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {p.date_of_birth ? (
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Calendar className="w-3.5 h-3.5 shrink-0" />
                            {new Date(
                              p.date_of_birth + "T00:00:00"
                            ).toLocaleDateString("pt-BR")}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden xl:table-cell">
                        {new Date(p.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        <span className="font-semibold">
                          {enrollCount[p.id] ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {p.banned ? (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-xs font-medium">
                            Banida
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-[#72CF92]/15 text-[#5bb577] text-xs font-medium">
                            Ativa
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/alunos/${p.id}`}
                          className="text-xs font-medium text-[#6699F3] hover:underline"
                        >
                          Ver →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Paginação */}
          {!cpfSearch && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              {page > 1 && (
                <Link
                  href={`?${q ? `q=${encodeURIComponent(q)}&` : ""}page=${page - 1}`}
                  className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted transition-colors"
                >
                  ← Anterior
                </Link>
              )}
              <span className="text-sm text-muted-foreground">
                Página {page} de {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={`?${q ? `q=${encodeURIComponent(q)}&` : ""}page=${page + 1}`}
                  className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted transition-colors"
                >
                  Próxima →
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
