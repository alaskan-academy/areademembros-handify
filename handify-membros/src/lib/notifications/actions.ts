"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dispararCampanha } from "./dispatch";

// ── Auth helpers ──────────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (p?.role !== "admin") redirect("/dashboard");
  return { supabase, userId: user.id };
}

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, userId: user.id };
}

// ── Leitura (usadas no Server Component do bell) ──────────────────

export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== userId) return 0;
  const service = createServiceClient();
  const { count } = await service
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);
  return count ?? 0;
}

export async function getNotifications(userId: string, limit = 30) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== userId) return [];
  const service = createServiceClient();
  const { data } = await service
    .from("notifications")
    .select("id, type, title, body, link, read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

// ── Mutações das alunas ──────────────────────────────────────────

export async function markNotificationRead(id: string) {
  const auth = await requireAuth();
  if (!auth) return;
  await auth.supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", id)
    .eq("user_id", auth.userId);
}

export async function markAllNotificationsRead() {
  const auth = await requireAuth();
  if (!auth) return;
  await auth.supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", auth.userId)
    .eq("read", false);
}

// ── Admin: campanhas ─────────────────────────────────────────────

export async function getCampaigns() {
  await requireAdmin();
  const service = createServiceClient();
  const { data } = await service
    .from("notification_campaigns")
    // target_count entra aqui porque sem ele o painel não sabe dizer "1.000 de
    // 4.557" — só o número solto, que a admin lê como se fosse a base inteira.
    .select("id, title, body, link, target, scheduled_at, sent_at, sent_count, target_count, status, created_at")
    .order("created_at", { ascending: false });
  return data ?? [];
}

const CampaignSchema = z.object({
  title: z.string().min(1, "Título obrigatório").max(120),
  body: z.string().min(1, "Mensagem obrigatória").max(500),
  link: z.string().url("URL inválida").optional().or(z.literal("")),
  target: z.string().min(1),
  scheduled_at: z.string().optional(),
});

export async function createCampaign(formData: FormData) {
  const { userId } = await requireAdmin();

  const raw = {
    title: formData.get("title") as string,
    body: formData.get("body") as string,
    link: (formData.get("link") as string) || "",
    target: (formData.get("target") as string) || "all",
    scheduled_at: (formData.get("scheduled_at") as string) || undefined,
  };

  const parsed = CampaignSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const service = createServiceClient();
  const scheduledAt = parsed.data.scheduled_at || null;
  const status = scheduledAt ? "scheduled" : "draft";

  const { data, error } = await service
    .from("notification_campaigns")
    .insert({
      title: parsed.data.title,
      body: parsed.data.body,
      link: parsed.data.link || null,
      target: parsed.data.target,
      scheduled_at: scheduledAt,
      status,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error) return { error: "Erro ao criar campanha." };

  // Disparo imediato se não agendado. Chama o interno: o requireAdmin() já
  // aconteceu no começo desta função, e o invólucro só repetiria a consulta de
  // role.
  if (!scheduledAt && data?.id) {
    await dispararCampanha(data.id);
  }

  revalidatePath("/admin/notificacoes");
  return { success: true };
}

export async function deleteCampaign(id: string) {
  await requireAdmin();
  const service = createServiceClient();
  await service.from("notification_campaigns").delete().eq("id", id);
  revalidatePath("/admin/notificacoes");
}

export async function cancelCampaign(id: string) {
  await requireAdmin();
  const service = createServiceClient();
  await service
    .from("notification_campaigns")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("status", "scheduled");
  revalidatePath("/admin/notificacoes");
}

// ── Disparo manual (Server Action pública — precisa de guarda) ────

/**
 * Invólucro do botão "Enviar agora". O corpo do disparo mora em `./dispatch`.
 *
 * Esta era a única ação de campanha sem `requireAdmin()` — e "use server"
 * publica toda função exportada daqui como endpoint: qualquer visitante que
 * forjasse o POST mandava notificação e push para as 4.557 alunas. A guarda de
 * `(admin)/layout.tsx` não cobre isso, porque ela roda na renderização da
 * página e a Server Action é um POST que pode sair de qualquer rota (não há
 * middleware no repo).
 *
 * A guarda não pode descer para `dispararCampanha`: o cron chama o mesmo código
 * sem sessão, e o `redirect("/login")` do requireAdmin mataria o Route Handler —
 * nenhuma campanha agendada voltaria a sair, em silêncio.
 */
export async function dispatchCampaign(campaignId: string) {
  const { userId } = await requireAdmin();
  await dispararCampanha(campaignId);

  // Regra 12 do CLAUDE.md: ação de admin vai para o audit_log. Esta é a única
  // que fala com a base inteira de uma vez.
  const service = createServiceClient();
  await service.from("audit_log").insert({
    admin_id: userId,
    action: "notification_campaign.dispatched",
    target_type: "notification_campaign",
    target_id: campaignId,
    meta: { origem: "manual" },
  });
}
