import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Image, Plus, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleBannerActiveAction } from "./actions";

const SLOT_LABELS: Record<string, string> = {
  header: "Header",
  lateral: "Lateral",
  "pos-aula": "Pós-aula",
};

const SLOT_COLORS: Record<string, string> = {
  header: "bg-[#6699F3]/10 text-[#6699F3]",
  lateral: "bg-[#72CF92]/10 text-[#5bb577]",
  "pos-aula": "bg-[#FEC649]/15 text-amber-600",
};

export default async function BannersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  // Admin usa service client implicitamente via RLS admin policy
  const { data: banners } = await supabase
    .from("banners")
    .select("id, title, image_url, link_url, product_codes, position_slot, starts_at, ends_at, active, created_at")
    .order("created_at", { ascending: false });

  const now = new Date();

  function validity(b: { starts_at: string | null; ends_at: string | null }) {
    const start = b.starts_at ? new Date(b.starts_at) : null;
    const end = b.ends_at ? new Date(b.ends_at) : null;
    if (start && start > now) return "Agendado";
    if (end && end < now) return "Expirado";
    return "Válido";
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Banners</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {banners?.length ?? 0} {(banners?.length ?? 0) !== 1 ? "banners" : "banner"} cadastrado
            {(banners?.length ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/admin/banners/novo"
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-[#6699F3] text-white hover:bg-[#5580d4] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo banner
        </Link>
      </div>

      {/* Lista */}
      {!banners?.length ? (
        <div className="handify-card py-16 flex flex-col items-center justify-center text-center text-muted-foreground">
          <Image className="w-10 h-10 mb-3 opacity-30" />
          <p className="font-medium">Nenhum banner criado</p>
          <p className="text-sm mt-1">Crie seu primeiro banner para começar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {banners.map((b) => {
            const status = validity(b);
            return (
              <div key={b.id} className="handify-card p-4 flex gap-4 items-center">
                {/* Thumbnail */}
                <div className="w-24 h-14 rounded-lg overflow-hidden bg-muted shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={b.image_url}
                    alt={b.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm truncate">{b.title}</p>
                    <span
                      className={cn(
                        "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                        SLOT_COLORS[b.position_slot] ?? "bg-muted text-muted-foreground"
                      )}
                    >
                      {SLOT_LABELS[b.position_slot] ?? b.position_slot}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span
                      className={cn(
                        "font-medium",
                        status === "Expirado" && "text-red-500",
                        status === "Agendado" && "text-amber-500",
                        status === "Válido" && "text-[#5bb577]"
                      )}
                    >
                      {status}
                    </span>
                    {b.starts_at && (
                      <span>
                        {new Date(b.starts_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                        {b.ends_at && ` → ${new Date(b.ends_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`}
                      </span>
                    )}
                    {b.product_codes.length > 0 && (
                      <span>{b.product_codes.length} curso(s) associado(s)</span>
                    )}
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Toggle ativo */}
                  <form
                    action={toggleBannerActiveAction.bind(null, b.id, !b.active)}
                  >
                    <button
                      type="submit"
                      className={cn(
                        "relative inline-flex w-9 h-5 rounded-full transition-colors focus:outline-none",
                        b.active ? "bg-[#6699F3]" : "bg-muted-foreground/30"
                      )}
                      title={b.active ? "Desativar" : "Ativar"}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
                          b.active ? "translate-x-4" : "translate-x-0.5"
                        )}
                      />
                    </button>
                  </form>

                  <Link
                    href={`/admin/banners/${b.id}`}
                    className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
