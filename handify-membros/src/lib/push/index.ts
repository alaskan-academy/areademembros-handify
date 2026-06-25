import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/service";

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL ?? "admin@handify.com.br"}`,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export interface PushPayload {
  title: string;
  body?: string;
  link?: string;
}

type SubRow = { endpoint: string; p256dh: string; auth: string };

async function sendToSub(sub: SubRow, payload: PushPayload): Promise<void> {
  await webpush.sendNotification(
    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    JSON.stringify(payload)
  );
}

async function cleanExpiredSub(endpoint: string) {
  const service = createServiceClient();
  await service.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  const service = createServiceClient();
  const { data: subs } = await service
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subs?.length) return;

  await Promise.allSettled(
    subs.map((sub) =>
      sendToSub(sub, payload).catch(async (err: { statusCode?: number }) => {
        if (err?.statusCode === 410) await cleanExpiredSub(sub.endpoint);
      })
    )
  );
}

export async function broadcastPush(
  payload: PushPayload,
  userIds?: string[]
): Promise<number> {
  const service = createServiceClient();
  let query = service
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth");
  if (userIds?.length) {
    query = query.in("user_id", userIds);
  }
  const { data: subs } = await query;
  if (!subs?.length) return 0;

  const results = await Promise.allSettled(
    subs.map((sub) =>
      sendToSub(sub, payload).catch(async (err: { statusCode?: number }) => {
        if (err?.statusCode === 410) await cleanExpiredSub(sub.endpoint);
        throw err;
      })
    )
  );

  return results.filter((r) => r.status === "fulfilled").length;
}
