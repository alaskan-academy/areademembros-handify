import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  verifyPaytSignature,
  PaytPayloadSchema,
  classifyEvent,
  type PaytPayload,
} from "@/lib/payments/payt";
import { encryptCpf, formatCpf } from "@/lib/cpf-crypto";
import { sendAccessConfirmedEmail } from "@/lib/email";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function logPaymentEvent(
  supabase: ReturnType<typeof createServiceClient>,
  data: {
    product_code: string;
    event_type: string;
    buyer_email: string;
    payload: PaytPayload;
    processed: boolean;
    error?: string;
  }
) {
  await supabase.from("payment_events").insert({
    platform: "payt",
    product_code: data.product_code,
    event_type: data.event_type,
    buyer_email: data.buyer_email,
    payload: data.payload,
    processed: data.processed,
    error: data.error ?? null,
  });
}

function calcExpiresAt(accessDays: number | null): string | null {
  if (!accessDays) return null; // vitalício
  const d = new Date();
  d.setDate(d.getDate() + accessDays);
  return d.toISOString();
}

// ── Handler principal ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const secret = process.env.PAYT_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[payt-webhook] PAYT_WEBHOOK_SECRET não configurado");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  // 1. Ler body bruto antes de qualquer parse (necessário para HMAC)
  const rawBody = await req.text();
  const signature = req.headers.get("x-payt-signature");

  // 2. Validar assinatura HMAC — rejeitar imediatamente se inválida
  if (!verifyPaytSignature(secret, rawBody, signature)) {
    console.warn("[payt-webhook] Assinatura HMAC inválida");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 3. Parsear e validar payload com Zod
  let payload: PaytPayload;
  try {
    const json = JSON.parse(rawBody);
    payload = PaytPayloadSchema.parse(json);
  } catch (err) {
    console.warn("[payt-webhook] Payload inválido:", err);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const action = classifyEvent(payload.event);

  // 4. Eventos desconhecidos — ack sem processar
  if (action === "ignore") {
    await logPaymentEvent(supabase, {
      product_code: payload.product_code,
      event_type: payload.event,
      buyer_email: payload.buyer_email,
      payload,
      processed: false,
      error: "Evento não mapeado — ignorado",
    });
    return NextResponse.json({ received: true });
  }

  // 5. Buscar curso pelo product_code (inclui access_days para calcular expiração)
  const { data: course } = await supabase
    .from("courses")
    .select("id, title, slug, access_days")
    .eq("product_code", payload.product_code)
    .maybeSingle();

  if (!course) {
    const msg = `Curso não encontrado para product_code: ${payload.product_code}`;
    console.error("[payt-webhook]", msg);
    await logPaymentEvent(supabase, {
      product_code: payload.product_code,
      event_type: payload.event,
      buyer_email: payload.buyer_email,
      payload,
      processed: false,
      error: msg,
    });
    return NextResponse.json({ received: true, warning: msg });
  }

  // 6. Buscar usuário pelo e-mail (via admin API do Supabase)
  const { data: usersData } = await supabase.auth.admin.listUsers();
  const user = usersData?.users?.find(
    (u) => u.email?.toLowerCase() === payload.buyer_email.toLowerCase()
  );

  if (!user) {
    const msg = `Usuário não encontrado para e-mail: ${payload.buyer_email}`;
    console.warn("[payt-webhook]", msg, "— evento salvo para processamento manual");
    await logPaymentEvent(supabase, {
      product_code: payload.product_code,
      event_type: payload.event,
      buyer_email: payload.buyer_email,
      payload,
      processed: false,
      error: msg,
    });
    return NextResponse.json({ received: true, warning: msg });
  }

  // 7. Executar ação de acesso
  if (action === "grant") {
    // access_days: null = vitalício, 365 = anual, 30 = mensal, etc.
    const expiresAt = calcExpiresAt(course.access_days as number | null);

    const { error } = await supabase.from("enrollments").upsert(
      {
        user_id: user.id,
        course_id: course.id,
        source: "payt",
        granted_at: new Date().toISOString(),
        expires_at: expiresAt,
      },
      { onConflict: "user_id,course_id" }
    );

    if (error) {
      const msg = `Erro ao criar matrícula: ${error.message}`;
      console.error("[payt-webhook]", msg);
      await logPaymentEvent(supabase, {
        product_code: payload.product_code,
        event_type: payload.event,
        buyer_email: payload.buyer_email,
        payload,
        processed: false,
        error: msg,
      });
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    // Salvar CPF criptografado no perfil (se Payt enviou e env key configurada)
    const rawCpf = payload.customer?.doc?.replace(/\D/g, "");
    if (rawCpf && rawCpf.length === 11) {
      try {
        const encrypted = encryptCpf(rawCpf);
        await supabase.from("profiles").update({ cpf_encrypted: encrypted }).eq("id", user.id);
        console.info(`[payt-webhook] CPF salvo para user=${user.id}`);
      } catch (err) {
        // Não bloqueia a matrícula se a criptografia falhar (ex: key não configurada)
        console.warn("[payt-webhook] CPF não salvo:", err instanceof Error ? err.message : err);
      }
    }

    console.info(
      `[payt-webhook] Matrícula concedida: user=${user.id} curso=${course.id} expires=${expiresAt ?? "vitalício"}`
    );

    // Notifica aluna sobre acesso liberado (background, não bloqueia a resposta)
    ;(async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      await sendAccessConfirmedEmail({
        to: payload.buyer_email,
        studentName: profile?.full_name ?? payload.buyer_email,
        courseTitle: course.title,
        courseSlug: course.slug,
      });
    })().catch((e) => console.error("[payt-webhook] access email:", e));
  } else {
    // revoke: marcar matrícula como expirada agora (revoga vitalícias e periódicas)
    const { error } = await supabase
      .from("enrollments")
      .update({ expires_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("course_id", course.id);

    if (error) {
      const msg = `Erro ao revogar matrícula: ${error.message}`;
      console.error("[payt-webhook]", msg);
      await logPaymentEvent(supabase, {
        product_code: payload.product_code,
        event_type: payload.event,
        buyer_email: payload.buyer_email,
        payload,
        processed: false,
        error: msg,
      });
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    await supabase.from("audit_log").insert({
      admin_id: null,
      action: "enrollment.revoked",
      target_type: "enrollment",
      target_id: course.id,
      meta: {
        user_id: user.id,
        course_id: course.id,
        reason: payload.event,
        transaction_id: payload.transaction_id,
      },
    });

    console.info(
      `[payt-webhook] Matrícula revogada: user=${user.id} curso=${course.id} evento=${payload.event}`
    );
  }

  // 8. Registrar evento processado com sucesso
  await logPaymentEvent(supabase, {
    product_code: payload.product_code,
    event_type: payload.event,
    buyer_email: payload.buyer_email,
    payload,
    processed: true,
  });

  return NextResponse.json({ received: true });
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
