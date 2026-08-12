import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getNotifications } from "@/lib/notifications/actions";
import NotificacoesClient from "./NotificacoesClient";
import SectionWelcomeBanner from "@/components/onboarding/SectionWelcomeBanner";
import { ONBOARDING_SECTIONS } from "@/lib/onboarding/sections";

export const metadata = { title: "Notificações — Handify" };

export default async function NotificacoesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [notifications, profileResult] = await Promise.all([
    getNotifications(user.id, 100),
    supabase.from("profiles").select("visited_sections").eq("id", user.id).single(),
  ]);

  const visitedSections = (profileResult?.data?.visited_sections as Record<string, boolean>) ?? {};
  const notifSection = ONBOARDING_SECTIONS.find((s) => s.id === "notificacoes")!;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {!visitedSections["notificacoes"] && <SectionWelcomeBanner section={notifSection} />}
      <NotificacoesClient
        initialNotifications={notifications}
        userId={user.id}
      />
    </div>
  );
}
