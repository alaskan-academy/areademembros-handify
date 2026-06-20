import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import BannerForm from "../banner-form";
import { updateBannerAction } from "../actions";
import DeleteBannerButton from "../delete-banner-button";

export default async function EditBannerPage({
  params,
}: {
  params: Promise<{ bannerId: string }>;
}) {
  const { bannerId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  const [{ data: banner }, { data: courses }] = await Promise.all([
    supabase
      .from("banners")
      .select("id, title, image_url, link_url, product_codes, position_slot, starts_at, ends_at, active")
      .eq("id", bannerId)
      .single(),
    supabase
      .from("courses")
      .select("id, title, product_code")
      .eq("published", true)
      .order("title"),
  ]);

  if (!banner) notFound();

  // bind bannerId para o server action
  const boundUpdateAction = updateBannerAction.bind(null, bannerId);

  return (
    <div className="max-w-xl space-y-6">
      <Link
        href="/admin/banners"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Banners
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Editar banner</h1>
          <p className="text-sm text-muted-foreground mt-1 truncate max-w-xs">
            {banner.title}
          </p>
        </div>

        {/* Excluir */}
        <DeleteBannerButton bannerId={bannerId} />
      </div>

      <BannerForm
        action={boundUpdateAction}
        banner={banner as Parameters<typeof BannerForm>[0]["banner"]}
        courses={(courses ?? []) as { id: string; title: string; product_code: string | null }[]}
        submitLabel="Salvar alterações"
      />
    </div>
  );
}
