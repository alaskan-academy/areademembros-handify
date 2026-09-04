import { createServiceClient } from "@/lib/supabase/service";
import { dispatchCampaign } from "@/lib/notifications/actions";
import { NextResponse } from "next/server";

// Vercel Cron — roda de hora em hora (vercel.json: "5 * * * *"), para uma
// campanha agendada sair perto da hora marcada.
//
// A Vercel manda o segredo em "Authorization: Bearer <CRON_SECRET>"; o cabeçalho
// "x-cron-secret" fica para chamada manual. Antes só o segundo era aceito, então
// nenhum agendamento jamais chegou a rodar.
export async function GET(req: Request) {
  const esperado = process.env.CRON_SECRET;
  const autorizado =
    !!esperado &&
    (req.headers.get("x-cron-secret") === esperado || req.headers.get("authorization") === `Bearer ${esperado}`);
  if (!autorizado) {
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
