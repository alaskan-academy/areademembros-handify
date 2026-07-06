import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  verifyPaytIntegrationKey,
  PaytPayloadSchema,
  classifyEvent,
  extractProductCodes,
  type PaytPayload,
} from "@/lib/payments/payt";
import { encryptCpf, hashCpf } from "@/lib/cpf-crypto";
import { sendAccessConfirmedEmail, sendRefundEmail } from "@/lib/email";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function logPaymentEvent(
  supabase: ReturnType<typeof createServiceClient>,
  data: {
    product_code: string;
    event_type: string;
    buyer_email: string;
    buyer_name?: string;
    payload: Record<string, unknown>;
    processed: boolean;
    error?: string;
  }
) {
  await supabase.from("payment_events").insert({
    platform: "payt",
    product_code: data.product_code,
    event_type: data.event_type,
    buyer_email: data.buyer_email,
    buyer_name: data.buyer_name ?? null,
    payload: data.payload,
    processed: data.processed,
    error: data.error ?? null,
  });
}

function calcExpiresAt(accessDays: number | null): string | null {
  if (!accessDays) return null;
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

  // 1. Parsear e validar payload com Zod (rawJson preserva todos os campos da Payt)
  let payload: PaytPayload;
  let rawJson: Record<string, unknown>;
  try {
    rawJson = JSON.parse(await req.text());
    payload = PaytPayloadSchema.parse(rawJson);
  } catch (err) {
    console.warn("[payt-webhook] Payload inválido:", err);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // 2. Validar integration_key (autenticação do postback Payt)
  if (!verifyPaytIntegrationKey(secret, payload.integration_key)) {
    console.warn("[payt-webhook] integration_key inválida");
    return NextResponse.json({ error: "Invalid key" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const action = classifyEvent(payload.status);
  const buyerEmail = payload.customer.email;
  const buyerName = payload.customer.name?.trim() || undefined;
  const mainProductCode = payload.product.code;

  // 4. Status desconhecido — ack sem processar (não é erro, só aguarda)
  if (action === "ignore") {
    await logPaymentEvent(supabase, {
      product_code: mainProductCode,
      event_type: payload.status,
      buyer_email: buyerEmail,
      buyer_name: buyerName,
      payload: rawJson,
      processed: false,
    });
    return NextResponse.json({ received: true });
  }

  // 5. Extrai todos os product codes (produto principal/itens + order bumps)
  const productCodes = extractProductCodes(payload);

  // 6. Busca todos os cursos correspondentes de uma vez (overlap: qualquer code do curso bate com qualquer code do payload)
  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, slug, access_days, product_codes")
    .overlaps("product_codes", productCodes);

  if (!courses?.length) {
    const msg = `Nenhum curso encontrado para product_codes: ${productCodes.join(", ")}`;
    console.warn("[payt-webhook]", msg);
    await logPaymentEvent(supabase, {
      product_code: mainProductCode,
      event_type: payload.status,
      buyer_email: buyerEmail,
      buyer_name: buyerName,
      payload: rawJson,
      processed: false,
      error: msg,
    });
    return NextResponse.json({ received: true, warning: msg });
  }

  // 7. Buscar usuário pelo e-mail
  const { data: usersData } = await supabase.auth.admin.listUsers();
  const user = usersData?.users?.find(
    (u) => u.email?.toLowerCase() === buyerEmail.toLowerCase()
  );

  // 8. Sem conta ainda — cria token de ativação por curso e envia e-mail
  if (!user) {
    if (action === "grant") {
      for (const course of courses) {
        const { data: tokenRow } = await supabase
          .from("activation_tokens")
          .insert({
            email: buyerEmail.toLowerCase(),
            course_id: course.id,
            buyer_name: buyerName ?? null,
            buyer_phone: payload.customer.phone?.trim() ?? null,
          })
          .select("token")
          .single();

        if (tokenRow?.token) {
          await sendAccessConfirmedEmail({
            to: buyerEmail,
            studentName: buyerName || buyerEmail,
            courseTitle: course.title,
            courseSlug: course.slug,
            activationToken: tokenRow.token,
          });
        }
      }
      console.info(`[payt-webhook] ${courses.length} token(s) de ativação criados para ${buyerEmail}`);
    }

    await logPaymentEvent(supabase, {
      product_code: mainProductCode,
      event_type: payload.status,
      buyer_email: buyerEmail,
      buyer_name: buyerName,
      payload: rawJson,
      processed: true, // token criado e e-mail enviado — tratado com sucesso
    });
    return NextResponse.json({ received: true });
  }

  // 9. Usuário existe — processar matrícula/revogação para cada curso
  const now = new Date().toISOString();
  let processed = 0;

  for (const course of courses) {
    if (action === "grant") {
      const expiresAt = calcExpiresAt(course.access_days as number | null);
      const { error } = await supabase.from("enrollments").upsert(
        {
          user_id: user.id,
          course_id: course.id,
          source: "payt",
          granted_at: now,
          expires_at: expiresAt,
        },
        { onConflict: "user_id,course_id" }
      );
      if (error) {
        console.error(`[payt-webhook] Erro ao matricular em ${course.id}:`, error.message);
      } else {
        processed++;
        console.info(`[payt-webhook] Matrícula concedida: user=${user.id} curso=${course.id} expires=${expiresAt ?? "vitalício"}`);
      }
    } else {
      // revoke — marca matrícula como expirada agora
      const { error } = await supabase
        .from("enrollments")
        .update({ expires_at: now })
        .eq("user_id", user.id)
        .eq("course_id", course.id);

      if (error) {
        console.error(`[payt-webhook] Erro ao revogar ${course.id}:`, error.message);
      } else {
        await supabase.from("audit_log").insert({
          admin_id: null,
          action: "enrollment.revoked",
          target_type: "enrollment",
          target_id: course.id,
          meta: {
            user_id: user.id,
            course_id: course.id,
            reason: payload.status,
            transaction_id: payload.transaction_id,
          },
        });
        processed++;
        console.info(`[payt-webhook] Matrícula revogada: user=${user.id} curso=${course.id} motivo=${payload.status}`);

        // E-mail de reembolso (fire-and-forget, não bloqueia a resposta)
        ;(async () => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .maybeSingle();
          await sendRefundEmail({
            to: buyerEmail,
            studentName: profile?.full_name ?? payload.customer.name ?? buyerEmail,
            courseTitle: course.title,
          });
        })().catch((e) => console.error("[payt-webhook] refund email:", e));
      }
    }
  }

  // 10. Salva CPF, telefone e nome no perfil (apenas no grant, sem sobrescrever dados existentes)
  if (action === "grant") {
    const rawCpf = payload.customer.doc?.replace(/\D/g, "");
    if (rawCpf && rawCpf.length === 11) {
      try {
        const encrypted = encryptCpf(rawCpf);
        const hash = hashCpf(rawCpf);
        await supabase
          .from("profiles")
          .update({ cpf_encrypted: encrypted, cpf_hash: hash })
          .eq("id", user.id);
      } catch (err) {
        console.warn("[payt-webhook] CPF não salvo:", err instanceof Error ? err.message : err);
      }
    }

    // Salva telefone se o perfil ainda não tiver (nunca sobrescreve dado editado pela aluna)
    const rawPhone = payload.customer.phone?.trim();
    if (rawPhone) {
      await supabase
        .from("profiles")
        .update({ phone: rawPhone })
        .eq("id", user.id)
        .is("phone", null);
    }

    // Salva nome se o perfil estiver sem nome (vazio ou null)
    if (buyerName) {
      await supabase
        .from("profiles")
        .update({ full_name: buyerName })
        .eq("id", user.id)
        .eq("full_name", "");
    }

    // E-mail de acesso confirmado (envia referenciando o produto principal)
    const mainCourse =
      courses.find((c) => (c.product_codes as string[])?.includes(mainProductCode)) ?? courses[0];
    ;(async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      await sendAccessConfirmedEmail({
        to: buyerEmail,
        studentName: profile?.full_name ?? payload.customer.name ?? buyerEmail,
        courseTitle: mainCourse.title,
        courseSlug: mainCourse.slug,
      });
    })().catch((e) => console.error("[payt-webhook] access email:", e));
  }

  // 11. Registrar evento
  await logPaymentEvent(supabase, {
    product_code: mainProductCode,
    event_type: payload.status,
    buyer_email: buyerEmail,
    buyer_name: buyerName,
    payload,
    processed: processed === courses.length,
    error:
      processed < courses.length
        ? `${courses.length - processed} curso(s) falharam`
        : undefined,
  });

  return NextResponse.json({ received: true, processed, total: courses.length });
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
