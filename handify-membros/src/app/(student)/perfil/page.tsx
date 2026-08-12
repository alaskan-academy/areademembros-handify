import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import PerfilView from "./perfil-view";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SectionWelcomeBanner from "@/components/onboarding/SectionWelcomeBanner";
import { ONBOARDING_SECTIONS } from "@/lib/onboarding/sections";

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
  const perfilSection = ONBOARDING_SECTIONS.find((s) => s.id === "perfil")!;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {!visitedSections["perfil"] && <SectionWelcomeBanner section={perfilSection} />}
      <Suspense
        fallback={
          <div className="flex justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-[#6699F3]" />
          </div>
        }
      >
        <PerfilView />
      </Suspense>
    </div>
  );
}
