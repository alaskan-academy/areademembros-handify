import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { encryptCpf, hashCpf } from "@/lib/cpf-crypto";
import { sendAccessConfirmedEmail, sendRefundEmail } from "@/lib/email";

/**
 * Evento de compra normalizado — qualquer plataforma (Payt, Kiwify) traduz seu
 * payload para este formato e o processamento a partir daqui é idêntico.
 */
export type PurchaseEvent = {
  /** Identificação da plataforma em `payment_events.platform`. */
  platform: string;
  /** Valor gravado em `enrollments.source` (enum `enrollment_source`). */
  source: "payt" | "kiwify";
  /** Rótulo do evento em `payment_events.event_type`. */
  eventType: string;
  action: "grant" | "revoke" | "ignore";
  /** Todos os códigos de produto da compra (principal, itens, order bumps). */
  productCodes: string[];
  /** Código do produto principal — usado para escolher o curso do e-mail. */
  mainProductCode: string;
  buyerEmail: string;
  buyerName?: string;
  buyerPhone?: string;
  /** CPF/CNPJ como veio da plataforma (limpo aqui dentro). */
  buyerDoc?: string;
  /** Valor pago em centavos. */
  amountPaid: number | null;
  transactionId: string;
  /** true apenas em estorno real de dinheiro — dispara e-mail de reembolso. */
  isRealRefund: boolean;
  /** Payload bruto preservado para auditoria. */
  rawPayload: Record<string, unknown>;
};

type Supabase = ReturnType<typeof createServiceClient>;

async function logPaymentEvent(
  supabase: Supabase,
  event: PurchaseEvent,
  data: { processed: boolean; error?: string; amountPaid?: number | null }
) {
  await supabase.from("payment_events").insert({
    platform: event.platform,
    product_code: event.mainProductCode,
    event_type: event.eventType,
    buyer_email: event.buyerEmail,
    buyer_name: event.buyerName ?? null,
    payload: event.rawPayload,
    amount_paid: data.amountPaid ?? null,
    processed: data.processed,
    error: data.error ?? null,
  });
}

/**
 * Devolve cada código também em maiúsculas e minúsculas.
 *
 * Necessário porque a comparação de array no Postgres é sensível a caixa e os
 * ids da Kiwify circulam nas duas formas (o painel mostra em maiúsculas, o
 * webhook manda em minúsculas). Códigos da Payt são maiúsculos e não mudam.
 */
function caseVariants(codes: string[]): string[] {
  return [...new Set(codes.flatMap((c) => [c, c.toLowerCase(), c.toUpperCase()]))];
}

/** Verifica se o curso tem o código, ignorando maiúsculas/minúsculas. */
function hasCode(codes: string[] | null, code: string): boolean {
  return !!codes?.some((c) => c.toLowerCase() === code.toLowerCase());
}

function calcExpiresAt(accessDays: number | null): string | null {
  if (!accessDays) return null;
  const d = new Date();
  d.setDate(d.getDate() + accessDays);
  return d.toISOString();
}

/**
 * Aplica o evento de compra: matricula ou revoga acesso, cria token de ativação
 * para quem ainda não tem conta, salva dados do comprador e registra o evento.
 *
 * Sempre responde 200 — a plataforma não deve reenviar o webhook por causa de
 * curso não cadastrado. Falhas ficam registradas em `payment_events.error`.
 */
export async function processPurchaseEvent(event: PurchaseEvent): Promise<NextResponse> {
  const supabase = createServiceClient();
  const log = `[${event.platform}-webhook]`;

  // Só registra valor pago em eventos de pagamento confirmado
  const amountPaid = event.action === "grant" ? event.amountPaid : null;

  // Evento sem efeito sobre o acesso — ack sem processar (não é erro, só aguarda)
  if (event.action === "ignore") {
    await logPaymentEvent(supabase, event, { processed: false, amountPaid });
    return NextResponse.json({ received: true });
  }

  // Busca todos os cursos correspondentes de uma vez
  // (overlap: qualquer code do curso bate com qualquer code do payload)
  //
  // `overlaps` compara texto exato, e os ids UUID da Kiwify aparecem ora em
  // maiúsculas ora em minúsculas dependendo de onde foram copiados. Mandar as
  // três formas evita que o acesso deixe de liberar por causa disso.
  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, slug, access_days, product_codes")
    .overlaps("product_codes", caseVariants(event.productCodes));

  if (!courses?.length) {
    const msg = `Nenhum curso encontrado para product_codes: ${event.productCodes.join(", ")}`;
    console.warn(log, msg);
    await logPaymentEvent(supabase, event, { processed: false, error: msg, amountPaid });
    return NextResponse.json({ received: true, warning: msg });
  }

  // Busca usuário pelo e-mail — lookup direto no profiles
  // (evita a limitação de 50 usuários do listUsers)
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", event.buyerEmail)
    .maybeSingle();
  const user = profileRow ? { id: profileRow.id } : null;

  // Sem conta ainda — cria token de ativação por curso e envia 1 único e-mail
  if (!user) {
    if (event.action === "grant") {
      const tokenResults = await Promise.all(
        courses.map((course) =>
          supabase
            .from("activation_tokens")
            .insert({
              email: event.buyerEmail.toLowerCase(),
              course_id: course.id,
              buyer_name: event.buyerName ?? null,
              buyer_phone: event.buyerPhone ?? null,
            })
            .select("token")
            .single()
            .then(({ data }) => ({ course, token: data?.token ?? null }))
        )
      );

      // Usa o token do curso principal (ou o primeiro disponível) no e-mail
      const mainCourse =
        courses.find((c) => hasCode(c.product_codes as string[], event.mainProductCode)) ??
        courses[0];
      const mainTokenResult = tokenResults.find((r) => r.course.id === mainCourse.id);
      const activationToken = mainTokenResult?.token ?? tokenResults.find((r) => r.token)?.token;

      if (activationToken) {
        await sendAccessConfirmedEmail({
          to: event.buyerEmail,
          studentName: event.buyerName || event.buyerEmail,
          courseTitle: mainCourse.title,
          courseSlug: mainCourse.slug,
          activationToken,
          totalCourses: courses.length,
        });
      }

      console.info(
        `${log} ${courses.length} token(s) criados, 1 e-mail enviado para ${event.buyerEmail}`
      );
    }

    await logPaymentEvent(supabase, event, { processed: true, amountPaid });
    return NextResponse.json({ received: true });
  }

  // Usuário existe — processar matrícula/revogação para cada curso em paralelo
  const now = new Date().toISOString();

  const results = await Promise.all(
    courses.map(async (course) => {
      if (event.action === "grant") {
        const expiresAt = calcExpiresAt(course.access_days as number | null);
        const { error } = await supabase.from("enrollments").upsert(
          {
            user_id: user.id,
            course_id: course.id,
            source: event.source,
            granted_at: now,
            expires_at: expiresAt,
          },
          { onConflict: "user_id,course_id" }
        );
        if (error) {
          console.error(`${log} Erro ao matricular em ${course.id}:`, error.message);
          return false;
        }
        console.info(
          `${log} Matrícula concedida: user=${user.id} curso=${course.id} expires=${expiresAt ?? "vitalício"}`
        );
        return true;
      }

      // revoke — marca matrícula como expirada agora
      const { data: revoked, error } = await supabase
        .from("enrollments")
        .update({ expires_at: now })
        .eq("user_id", user.id)
        .eq("course_id", course.id)
        .select("id");

      if (error) {
        console.error(`${log} Erro ao revogar ${course.id}:`, error.message);
        return false;
      }
      if (!revoked?.length) {
        console.info(
          `${log} Revoke ignorado (sem matrícula ativa): user=${user.id} curso=${course.id} motivo=${event.eventType}`
        );
        return true;
      }
      await supabase.from("audit_log").insert({
        admin_id: null,
        action: "enrollment.revoked",
        target_type: "enrollment",
        target_id: course.id,
        meta: {
          user_id: user.id,
          course_id: course.id,
          reason: event.eventType,
          platform: event.platform,
          transaction_id: event.transactionId,
        },
      });
      console.info(
        `${log} Matrícula revogada: user=${user.id} curso=${course.id} motivo=${event.eventType}`
      );

      // E-mail de reembolso só para estorno real
      // (não para PIX expirado/cancelado sem pagamento)
      if (event.isRealRefund) {
        ;(async () => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .maybeSingle();
          await sendRefundEmail({
            to: event.buyerEmail,
            studentName: profile?.full_name ?? event.buyerName ?? event.buyerEmail,
            courseTitle: course.title,
          });
        })().catch((e) => console.error(`${log} refund email:`, e));
      }
      return true;
    })
  );

  const processed = results.filter(Boolean).length;

  // Salva CPF, telefone e nome no perfil
  // (apenas no grant, sem sobrescrever dados existentes)
  if (event.action === "grant") {
    const rawCpf = event.buyerDoc?.replace(/\D/g, "");
    if (rawCpf && rawCpf.length === 11) {
      try {
        await supabase
          .from("profiles")
          .update({ cpf_encrypted: encryptCpf(rawCpf), cpf_hash: hashCpf(rawCpf) })
          .eq("id", user.id);
      } catch (err) {
        console.warn(`${log} CPF não salvo:`, err instanceof Error ? err.message : err);
      }
    }

    // Salva telefone se o perfil ainda não tiver
    // (nunca sobrescreve dado editado pela aluna)
    if (event.buyerPhone) {
      await supabase
        .from("profiles")
        .update({ phone: event.buyerPhone })
        .eq("id", user.id)
        .is("phone", null);
    }

    // Salva nome se o perfil estiver sem nome
    if (event.buyerName) {
      await supabase
        .from("profiles")
        .update({ full_name: event.buyerName })
        .eq("id", user.id)
        .eq("full_name", "");
    }

    // E-mail de acesso confirmado (referenciando o produto principal)
    const mainCourse =
      courses.find((c) => hasCode(c.product_codes as string[], event.mainProductCode)) ??
      courses[0];
    ;(async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      await sendAccessConfirmedEmail({
        to: event.buyerEmail,
        studentName: profile?.full_name ?? event.buyerName ?? event.buyerEmail,
        courseTitle: mainCourse.title,
        courseSlug: mainCourse.slug,
        totalCourses: courses.length,
      });
    })().catch((e) => console.error(`${log} access email:`, e));
  }

  await logPaymentEvent(supabase, event, {
    processed: processed === courses.length,
    error:
      processed < courses.length ? `${courses.length - processed} curso(s) falharam` : undefined,
    amountPaid,
  });

  return NextResponse.json({ received: true, processed, total: courses.length });
}
