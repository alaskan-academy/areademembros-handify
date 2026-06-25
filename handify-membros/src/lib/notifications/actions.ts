"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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
    .select("id, title, body, link, target, scheduled_at, sent_at, sent_count, status, created_at")
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

  // Disparo imediato se não agendado
  if (!scheduledAt && data?.id) {
    await dispatchCampaign(data.id);
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

// ── Dispatcher: envia notificações para as alunas ─────────────────

export async function dispatchCampaign(campaignId: string) {
  const service = createServiceClient();

  const { data: campaign } = await service
    .from("notification_campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();

  if (!campaign || campaign.status === "sent" || campaign.status === "cancelled") return;

  await service
    .from("notification_campaigns")
    .update({ status: "sending" })
    .eq("id", campaignId);

  // Busca usuárias alvo
  let userIds: string[] = [];

  if (campaign.target === "all") {
    const { data: profiles } = await service
      .from("profiles")
      .select("id")
      .eq("role", "student")
      .eq("banned", false);
    userIds = (profiles ?? []).map((p) => p.id);
  } else if (campaign.target.startsWith("course:")) {
    const courseId = campaign.target.replace("course:", "");
    const now = new Date().toISOString();
    const { data: enrollments } = await service
      .from("enrollments")
      .select("user_id")
      .eq("course_id", courseId)
      .or(`expires_at.is.null,expires_at.gte.${now}`);
    userIds = (enrollments ?? []).map((e) => e.user_id);
  }

  if (userIds.length === 0) {
    await service
      .from("notification_campaigns")
      .update({ status: "sent", sent_at: new Date().toISOString(), sent_count: 0 })
      .eq("id", campaignId);
    return;
  }

  // Insere notificações em batch (máx 500 por vez)
  const BATCH = 500;
  let totalSent = 0;
  for (let i = 0; i < userIds.length; i += BATCH) {
    const batch = userIds.slice(i, i + BATCH).map((userId) => ({
      user_id: userId,
      type: "admin_broadcast",
      title: campaign.title,
      body: campaign.body,
      link: campaign.link ?? null,
      read: false,
    }));
    await service.from("notifications").insert(batch);
    totalSent += batch.length;
  }

  await service
    .from("notification_campaigns")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      sent_count: totalSent,
    })
    .eq("id", campaignId);

  revalidatePath("/admin/notificacoes");
}
