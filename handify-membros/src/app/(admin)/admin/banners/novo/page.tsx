import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import BannerForm from "../banner-form";
import { createBannerAction } from "../actions";

export default async function NovoBannerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, product_code")
    .eq("published", true)
    .order("title");

  return (
    <div className="max-w-xl space-y-6">
      <Link
        href="/admin/banners"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Banners
      </Link>

      <div>
        <h1 className="text-xl font-bold">Novo banner</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure a imagem, o link e onde o banner será exibido.
        </p>
      </div>

      <BannerForm
        action={createBannerAction}
        courses={(courses ?? []) as { id: string; title: string; product_code: string | null }[]}
        submitLabel="Criar banner"
      />
    </div>
  );
}
