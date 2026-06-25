import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FileText, Plus, Globe, EyeOff, Pencil } from "lucide-react";

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (p?.role !== "admin") redirect("/dashboard");
}

export default async function PaginasAdminPage() {
  await assertAdmin();
  const service = createServiceClient();

  const { data: pages } = await service
    .from("static_pages")
    .select("id, slug, title, published, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#2D2D2D]">Páginas Estáticas</h1>
          <p className="text-sm text-foreground/50 mt-1">
            Termos de uso, privacidade e outras páginas de conteúdo
          </p>
        </div>
        <Link
          href="/admin/paginas/nova"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#6699F3] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Nova página
        </Link>
      </div>

      {(!pages || pages.length === 0) ? (
        <div className="handify-card p-12 flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#6699F3]/10 flex items-center justify-center">
            <FileText className="w-6 h-6 text-[#6699F3]" />
          </div>
          <p className="font-semibold text-foreground/70">Nenhuma página criada ainda</p>
          <p className="text-sm text-muted-foreground">
            Crie páginas como Termos de Uso e Política de Privacidade
          </p>
          <Link
            href="/admin/paginas/nova"
            className="mt-2 px-4 py-2 rounded-lg bg-[#6699F3] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Criar primeira página
          </Link>
        </div>
      ) : (
        <div className="handify-card divide-y divide-border/50">
          {pages.map((page) => (
            <div key={page.id} className="flex items-center gap-4 px-5 py-4">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  page.published ? "bg-[#72CF92]/15" : "bg-muted"
                }`}
              >
                {page.published
                  ? <Globe className="w-4 h-4 text-[#72CF92]" />
                  : <EyeOff className="w-4 h-4 text-foreground/30" />
                }
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{page.title}</p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">/p/{page.slug}</p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {page.published ? (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#72CF92]/15 text-[#2a7a48]">
                    Publicada
                  </span>
                ) : (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-foreground/40">
                    Rascunho
                  </span>
                )}

                <Link
                  href={`/admin/paginas/${page.id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Editar
                </Link>

                {page.published && (
                  <Link
                    href={`/p/${page.slug}`}
                    target="_blank"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-[#6699F3] hover:bg-[#6699F3]/5 transition-colors"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    Ver
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
