import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Award } from "lucide-react";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ hash: string }>;
}): Promise<Metadata> {
  const { hash } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("certificates")
    .select("courses(title)")
    .eq("verify_hash", hash)
    .maybeSingle();

  const courseTitle = (data?.courses as unknown as { title: string } | null)?.title;

  return {
    title: courseTitle
      ? `Certificado — ${courseTitle} | Handify™`
      : "Verificação de Certificado | Handify™",
  };
}

export default async function VerificarPage({
  params,
}: {
  params: Promise<{ hash: string }>;
}) {
  const { hash } = await params;
  const supabase = await createClient();

  const { data: cert } = await supabase
    .from("certificates")
    .select(
      "id, issued_at, verify_hash, profile:profiles(full_name), course:courses(title, workload_hours)"
    )
    .eq("verify_hash", hash)
    .maybeSingle();

  if (!cert) notFound();

  type ProfileRef = { full_name: string };
  type CourseRef = { title: string; workload_hours: number };

  const profile = cert.profile as unknown as ProfileRef | null;
  const course = cert.course as unknown as CourseRef | null;

  const issuedAt = new Date(cert.issued_at);
  const formattedDate = issuedAt.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-[#F5F5F0] flex flex-col">
      {/* Header simples */}
      <header className="bg-white border-b border-border/40">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="font-bold text-[#6699F3] text-xl tracking-tight">
            Handify™
          </Link>
          <span className="text-xs text-muted-foreground">Verificação de Certificado</span>
        </div>
      </header>

      {/* Faixa tricolor */}
      <div className="flex h-1">
        <div className="flex-1 bg-[#6699F3]" />
        <div className="flex-1 bg-[#72CF92]" />
        <div className="flex-1 bg-[#FEC649]" />
      </div>

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-lg space-y-6">
          {/* Selo de verificação */}
          <div className="text-center space-y-3">
            <div className="inline-flex w-20 h-20 rounded-full bg-[#72CF92]/15 items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-[#72CF92]" />
            </div>
            <div>
              <p className="text-[#72CF92] text-sm font-semibold uppercase tracking-widest">
                Certificado Autêntico
              </p>
              <h1 className="text-2xl font-bold text-foreground mt-1">
                Verificação confirmada
              </h1>
            </div>
          </div>

          {/* Card com dados do certificado */}
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            {/* Header do card */}
            <div className="bg-[#0F0F0F] px-6 py-5 flex items-center gap-3">
              <Award className="w-6 h-6 text-[#6699F3] shrink-0" />
              <div>
                <p className="text-white font-semibold text-sm">Certificado de Conclusão</p>
                <p className="text-[#6699F3] text-xs font-medium">Handify™</p>
              </div>
            </div>

            {/* Dados */}
            <div className="px-6 py-6 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
                  Concluído por
                </p>
                <p className="text-xl font-bold text-foreground">
                  {profile?.full_name ?? "—"}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
                  Curso
                </p>
                <p className="font-semibold text-foreground">{course?.title ?? "—"}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
                    Carga horária
                  </p>
                  <p className="font-medium text-foreground">
                    {course?.workload_hours ?? 0}h
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
                    Emitido em
                  </p>
                  <p className="font-medium text-foreground">{formattedDate}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Hash de verificação:{" "}
                  <span className="font-mono text-[10px] break-all">{cert.verify_hash}</span>
                </p>
              </div>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Este certificado foi emitido pela{" "}
            <span className="font-semibold text-[#6699F3]">Handify™</span> — Plataforma de
            Cursos de Artesanato.
          </p>
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Handify™ — Todos os direitos reservados
      </footer>
    </div>
  );
}
