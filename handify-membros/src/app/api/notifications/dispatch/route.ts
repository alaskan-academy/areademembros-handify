import { createServiceClient } from "@/lib/supabase/service";
import { dispatchCampaign } from "@/lib/notifications/actions";
import { NextResponse } from "next/server";

// Vercel Cron — roda a cada 15 minutos (configurado em vercel.json)
// Também pode ser chamado manualmente via GET com CRON_SECRET no header
export async function GET(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const now = new Date().toISOString();

  const { data: pending } = await service
    .from("notification_campaigns")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_at", now);

  if (!pending || pending.length === 0) {
    return NextResponse.json({ dispatched: 0 });
  }

  for (const campaign of pending) {
    await dispatchCampaign(campaign.id);
  }

  return NextResponse.json({ dispatched: pending.length });
}
