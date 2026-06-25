import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Download, UserCircle, UserPlus, Phone, Calendar } from "lucide-react";
import { hashCpf, decryptCpf } from "@/lib/cpf-crypto";
import AlunosSearch from "./alunos-search";

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

  // Backfill: popula cpf_hash para perfis com cpf_encrypted mas sem hash (migração retroativa)
  {
    const { data: needsHash } = await service
      .from("profiles")
      .select("id, cpf_encrypted")
      .not("cpf_encrypted", "is", null)
      .is("cpf_hash", null);

    if (needsHash && needsHash.length > 0) {
      await Promise.all(
        (needsHash as { id: string; cpf_encrypted: string }[]).map(async (p) => {
          try {
            const digits = decryptCpf(p.cpf_encrypted).replace(/\D/g, "");
            const hash = hashCpf(digits);
            await service.from("profiles").update({ cpf_hash: hash }).eq("id", p.id);
          } catch {
            // ignora se a descriptografia falhar
          }
        })
      );
    }
  }

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

  if (q && isCpf(q)) {
    cpfSearch = true;
    const cpfDigits = formatCpfRaw(q);
    const cpfH = hashCpf(cpfDigits);

    // 1. Busca pelo hash em profiles (cadastros manuais com CPF)
    const { data: byHash, count: hashCount } = await service
      .from("profiles")
      .select("id, full_name, email, phone, date_of_birth, role, banned, created_at", { count: "exact" })
      .eq("cpf_hash", cpfH)
      .neq("role", "admin");

    if ((byHash ?? []).length > 0) {
      profiles = (byHash ?? []) as ProfileRow[];
      count = hashCount ?? 0;
    } else {
      // 2. Fallback: busca no payload do Payt (compras sem cadastro manual de CPF)
      const { data: events } = await service
        .from("payment_events")
        .select("buyer_email")
        .filter("payload->customer->>doc", "eq", cpfDigits)
        .limit(10);

      const emails = [...new Set((events ?? []).map((e) => e.buyer_email).filter(Boolean))];

      if (emails.length > 0) {
        const { data, count: c } = await service
          .from("profiles")
          .select("id, full_name, email, phone, date_of_birth, role, banned, created_at", { count: "exact" })
          .in("email", emails)
          .neq("role", "admin");
        profiles = (data ?? []) as ProfileRow[];
        count = c ?? 0;
      }
    }
  } else {
    let query = service
      .from("profiles")
      .select("id, full_name, email, phone, date_of_birth, role, banned, created_at", { count: "exact" })
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
      <AlunosSearch defaultValue={q} />

      {cpfSearch && (
        <p className="text-xs text-[#6699F3]">Buscando por CPF nos registros de compra.</p>
      )}

      {/* Tabela */}
      <div className="handify-card overflow-hidden overflow-x-auto">
        {profiles.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <UserCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhuma aluna encontrada</p>
            {q && (
              <p className="text-sm mt-1">
                {cpfSearch ? "CPF não encontrado nos registros." : "Tente um termo diferente."}
              </p>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-foreground/70">Nome / E-mail</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground/70 hidden md:table-cell">Telefone</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground/70 hidden lg:table-cell">Nascimento</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground/70 hidden xl:table-cell">Cadastro</th>
                <th className="text-center px-4 py-3 font-semibold text-foreground/70 hidden sm:table-cell">Matrículas</th>
                <th className="text-center px-4 py-3 font-semibold text-foreground/70">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {profiles.map((p) => (
                <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                  {/* Nome + e-mail empilhados */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ background: "#6699F3" }}
                      >
                        {p.full_name?.charAt(0)?.toUpperCase() ?? "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate max-w-[160px]">{p.full_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[160px]">{p.email ?? "—"}</p>
                      </div>
                    </div>
                  </td>
                  {/* Telefone */}
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
                  {/* Nascimento */}
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {p.date_of_birth ? (
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        {new Date(p.date_of_birth + "T00:00:00").toLocaleDateString("pt-BR")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                  {/* Cadastro */}
                  <td className="px-4 py-3 text-muted-foreground hidden xl:table-cell">
                    {new Date(p.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  {/* Matrículas */}
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    <span className="font-semibold">{enrollCount[p.id] ?? 0}</span>
                  </td>
                  {/* Status */}
                  <td className="px-4 py-3 text-center">
                    {p.banned ? (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-xs font-medium">Banida</span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-[#72CF92]/15 text-[#5bb577] text-xs font-medium">Ativa</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/alunos/${p.id}`} className="text-xs font-medium text-[#6699F3] hover:underline">
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
