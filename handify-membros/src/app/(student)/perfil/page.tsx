import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import PerfilView from "./perfil-view";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PageTour from "@/components/tour/PageTour";
import { SECTION_TOURS } from "@/lib/tour/tours";
import { getPlanoProgresso } from "@/lib/promo/plano-progresso";

export default async function PerfilPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("visited_sections")
    .eq("id", user.id)
    .single();

  const visitedSections = (profileData?.visited_sections as Record<string, boolean>) ?? {};
  // Convite ao Handify Completo junto dos certificados — momento em que ela
  // acabou de ganhar algo. Null para quem já tem o plano.
  const planoProgresso = await getPlanoProgresso(user.id);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <PageTour sectionId="perfil" visited={!!visitedSections["perfil"]} steps={SECTION_TOURS.perfil} />
      <Suspense
        fallback={
          <div className="flex justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-[#6699F3]" />
          </div>
        }
      >
        <PerfilView planoProgresso={planoProgresso} />
      </Suspense>
    </div>
  );
}
