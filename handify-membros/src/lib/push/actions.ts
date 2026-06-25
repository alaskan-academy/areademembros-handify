"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { z } from "zod";

const SubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function subscribePush(subscription: unknown) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const parsed = SubscriptionSchema.safeParse(subscription);
  if (!parsed.success) return { error: "Subscription inválida" };

  const service = createServiceClient();
  const { error } = await service.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    },
    { onConflict: "user_id,endpoint" }
  );

  if (error) return { error: "Erro ao salvar subscription" };
  return { success: true };
}

export async function unsubscribePush(endpoint: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const service = createServiceClient();
  await service
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  return { success: true };
}

export async function getUserPushEndpoints(): Promise<string[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const service = createServiceClient();
  const { data } = await service
    .from("push_subscriptions")
    .select("endpoint")
    .eq("user_id", user.id);

  return (data ?? []).map((r) => r.endpoint);
}
