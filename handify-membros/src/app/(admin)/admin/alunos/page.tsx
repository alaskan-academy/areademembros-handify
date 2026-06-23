import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Search, Download, UserCircle, UserPlus } from "lucide-react";

const PAGE_SIZE = 25;

function isCpf(q: string) {
  return q.replace(/\D/g, "").length === 11;
}

function formatCpfRaw(q: string) {
  return q.replace(/\D/g, "");
}

export default async function AlunosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
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

  const { q: rawQ, page: rawPage } = await searchParams;
  const q = rawQ?.trim() ?? "";
  const page = Math.max(1, parseInt(rawPage ?? "1"));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const service = createServiceClient();

  type ProfileRow = {
    id: string;
    full_name: string | null;
    email: string | null;
    role: string;
    banned: boolean | null;
    created_at: string;
  };

  let profiles: ProfileRow[] = [];
  let count = 0;
  let cpfSearch = false;

  if (q && isCpf(q)) {
    // Busca por CPF no payment_events (payload JSON do Payt)
    cpfSearch = true;
    const cpfDigits = formatCpfRaw(q);
    const { data: events } = await service
      .from("payment_events")
      .select("buyer_email")
      .filter("payload->customer->>doc", "eq", cpfDigits)
      .limit(10);

    const emails = [...new Set((events ?? []).map((e) => e.buyer_email).filter(Boolean))];

    if (emails.length > 0) {
      const { data, count: c } = await service
        .from("profiles")
        .select("id, full_name, email, role, banned, created_at", { count: "exact" })
        .in("email", emails)
        .neq("role", "admin");
      profiles = (data ?? []) as ProfileRow[];
      count = c ?? 0;
    }
  } else {
    let query = service
      .from("profiles")
      .select("id, full_name, email, role, banned, created_at", { count: "exact" })
      .neq("role", "admin")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (q) {
      query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
    }

    const { data, count: c } = await query;
    profiles = (data ?? []) as ProfileRow[];
    count = c ?? 0;
  }

  // Contagem de matrículas
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

  const totalPages = Math.ceil(count / PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Alunas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {count}{" "}
            {count !== 1 ? "alunas cadastradas" : "aluna cadastrada"}
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

      {/* Busca */}
      <form method="GET" className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nome, e-mail ou CPF…"
          className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 focus:border-[#6699F3]"
        />
      </form>

      {cpfSearch && (
        <p className="text-xs text-[#6699F3]">
          Buscando por CPF nos registros de compra.
        </p>
      )}

      {/* Tabela */}
      <div className="handify-card overflow-hidden">
        {profiles.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <UserCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhuma aluna encontrada</p>
            {q && (
              <p className="text-sm mt-1">
                {cpfSearch
                  ? "CPF não encontrado nos registros de compra."
                  : "Tente um termo diferente."}
              </p>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-foreground/70">
                  Nome
                </th>
                <th className="text-left px-4 py-3 font-semibold text-foreground/70 hidden sm:table-cell">
                  E-mail
                </th>
                <th className="text-center px-4 py-3 font-semibold text-foreground/70 hidden md:table-cell">
                  Matrículas
                </th>
                <th className="text-left px-4 py-3 font-semibold text-foreground/70 hidden lg:table-cell">
                  Cadastro
                </th>
                <th className="text-center px-4 py-3 font-semibold text-foreground/70">
                  Status
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {profiles.map((p) => (
                <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ background: "#6699F3" }}
                      >
                        {p.full_name?.charAt(0)?.toUpperCase() ?? "?"}
                      </div>
                      <span className="font-medium truncate max-w-[140px]">
                        {p.full_name ?? "—"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell truncate max-w-[180px]">
                    {p.email ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-center hidden md:table-cell">
                    <span className="font-semibold">{enrollCount[p.id] ?? 0}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    {new Date(p.created_at).toLocaleDateString("pt-BR")}
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

      {/* Paginação — só na busca normal */}
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
    </div>
  );
}
