import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Award, ExternalLink, ArrowLeft, CheckCircle2 } from "lucide-react";

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (p?.role !== "admin") redirect("/dashboard");
}

export default async function CertificadosPage() {
  await assertAdmin();
  const service = createServiceClient();

  const [{ data: certs }, { data: profiles }, { data: courses }] = await Promise.all([
    service
      .from("certificates")
      .select("id, user_id, course_id, verify_hash, issued_at")
      .order("issued_at", { ascending: false }),
    service.from("profiles").select("id, full_name, email, avatar_url").eq("role", "student"),
    service.from("courses").select("id, title, slug"),
  ]);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const courseMap = new Map((courses ?? []).map((c) => [c.id, c]));

  const rows = (certs ?? []).map((cert) => ({
    ...cert,
    profile: profileMap.get(cert.user_id),
    course: courseMap.get(cert.course_id),
  }));

  const uniqueStudents = new Set(rows.map((r) => r.user_id)).size;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/metricas"
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </Link>
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Award className="w-5 h-5 text-[#FEC649]" />
            Certificados emitidos
          </h2>
          <p className="text-sm text-muted-foreground">
            {rows.length} certificado{rows.length !== 1 ? "s" : ""} · {uniqueStudents} aluna{uniqueStudents !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Tabela */}
      <div className="handify-card overflow-hidden overflow-x-auto">
        {rows.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Award className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum certificado emitido ainda.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-foreground/70">Aluna</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground/70 hidden sm:table-cell">Curso</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground/70 hidden md:table-cell">Emitido em</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/20 transition-colors">
                  {/* Aluna */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <StudentAvatar
                        name={row.profile?.full_name ?? row.profile?.email ?? "?"}
                        url={row.profile?.avatar_url ?? null}
                        size={32}
                      />
                      <div className="min-w-0">
                        <p className="font-medium truncate max-w-[160px]">
                          {row.profile?.full_name ?? <span className="text-muted-foreground italic text-xs">Sem nome</span>}
                        </p>
                        <p className="text-xs text-muted-foreground truncate max-w-[160px]">
                          {row.profile?.email ?? "—"}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Curso */}
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-sm text-foreground/80 truncate max-w-[200px] block">
                      {row.course?.title ?? "—"}
                    </span>
                  </td>

                  {/* Data */}
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs text-muted-foreground">
                      {new Date(row.issued_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </span>
                  </td>

                  {/* Verificar */}
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/verificar/${row.verify_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-[#72CF92]/30 text-[#3d9e5a] hover:bg-[#72CF92]/10 transition-colors whitespace-nowrap"
                      title="Verificar certificado"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Verificar</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StudentAvatar({ name, url, size = 36 }: { name: string; url: string | null; size?: number }) {
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
      style={{ width: size, height: size, background: "#FEC649", fontSize: size * 0.35, color: "#2D2D2D" }}
    >
      {initials || "?"}
    </div>
  );
}
