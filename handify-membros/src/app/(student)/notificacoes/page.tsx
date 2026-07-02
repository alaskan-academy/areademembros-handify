import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getNotifications } from "@/lib/notifications/actions";
import NotificacoesClient from "./NotificacoesClient";

export const metadata = { title: "Notificações — Handify" };

export default async function NotificacoesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const notifications = await getNotifications(user.id, 100);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <NotificacoesClient
        initialNotifications={notifications}
        userId={user.id}
      />
    </div>
  );
}
