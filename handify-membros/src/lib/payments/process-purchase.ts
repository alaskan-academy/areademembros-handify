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
  /**
   * `revoke_if_paid`: a plataforma mandou um cancelamento que pode ser PIX
   * abandonado (nada a desfazer) ou estorno concluído (revogar). O adaptador
   * não tem como saber; `processPurchaseEvent` resolve olhando se já houve
   * pagamento aprovado deste e-mail para esses códigos.
   */
  action: "grant" | "revoke" | "revoke_if_paid" | "ignore";
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

  // "canceled" na Payt é ambíguo: PIX/boleto abandonado antes de pagar (nada a
  // desfazer) OU reembolso concluído (paid → refund_requested → canceled). Só dá
  // para saber olhando o histórico: se já houve pagamento aprovado deste e-mail
  // para algum desses códigos, é estorno e revoga. Achado em 03/09/2026: 6 alunas
  // cancelaram o Handify Completo (R$327 devolvido) e ficaram com os 23 cursos.
  if (event.action === "revoke_if_paid") {
    const { data: pagoAntes } = await supabase
      .from("payment_events")
      .select("id")
      .ilike("buyer_email", event.buyerEmail)
      .in("event_type", ["paid", "approved", "completed", "confirmed", "order_approved", "subscription_renewed"])
      .in("product_code", caseVariants(event.productCodes))
      .limit(1)
      .maybeSingle();
    event = pagoAntes
      ? { ...event, action: "revoke", isRealRefund: true }
      : { ...event, action: "ignore" };
    console.info(
      `${log} canceled resolvido como ${event.action} (${pagoAntes ? "havia pagamento" : "sem pagamento anterior"}) para ${event.buyerEmail}`
    );
  }

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
    .select("id, title, slug, access_days, checkout_codes")
    .overlaps("checkout_codes", caseVariants(event.productCodes));

  if (!courses?.length) {
    const msg = `Nenhum curso encontrado para checkout_codes: ${event.productCodes.join(", ")}`;
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
        courses.find((c) => hasCode(c.checkout_codes as string[], event.mainProductCode)) ??
        courses[0];
      const mainTokenResult = tokenResults.find((r) => r.course.id === mainCourse.id);
      const activationToken = mainTokenResult?.token ?? tokenResults.find((r) => r.token)?.token;

      // A compradora ainda não tem conta: sem esse e-mail ela não tem como
      // entrar. Se o envio falhar, o evento fica marcado como não processado
      // com o motivo, para aparecer no painel de webhooks e ser reenviado.
      let emailError: string | undefined;

      if (!activationToken) {
        emailError = "Token de ativação não foi criado — e-mail de acesso não enviado";
      } else {
        try {
          await sendAccessConfirmedEmail({
            to: event.buyerEmail,
            studentName: event.buyerName || event.buyerEmail,
            courseTitle: mainCourse.title,
            courseSlug: mainCourse.slug,
            activationToken,
            totalCourses: courses.length,
          });
          console.info(
            `${log} ${courses.length} token(s) criados, 1 e-mail enviado para ${event.buyerEmail}`
          );
        } catch (err) {
          emailError = `Token criado, mas o e-mail de acesso falhou: ${
            err instanceof Error ? err.message : String(err)
          }`;
          console.error(`${log} ${emailError} (${event.buyerEmail})`);
        }
      }

      await logPaymentEvent(supabase, event, {
        processed: !emailError,
        error: emailError,
        amountPaid,
      });
      return NextResponse.json({ received: true });
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

  // ─── Handify Completo ──────────────────────────────────────────────────────
  // O plano é uma entidade própria (`memberships`) — quem comprou os 23 cursos
  // separados NÃO é Completo. As matrículas dos cursos já foram feitas acima
  // pelos checkout_codes; aqui registramos o plano em si. Se a compradora ainda
  // não tem conta, quem cria a membership é `process_pending_payment_events`
  // (SQL) quando a conta nasce. Contexto em .claude/plans/tiers-handify.md.
  const { data: promo } = await supabase
    .from("annual_promo")
    .select("subscription_product_codes")
    .maybeSingle();
  const planCodes = (promo?.subscription_product_codes as string[] | null) ?? [];
  const isPlanEvent = event.productCodes.some((c) => hasCode(planCodes, c));

  if (isPlanEvent) {
    const { data: current } = await supabase
      .from("memberships")
      .select("id, expires_at")
      .eq("user_id", user.id)
      .eq("plan", "completo")
      .is("revoked_at", null)
      .maybeSingle();

    if (event.action === "grant") {
      const stillActive =
        current && (!current.expires_at || new Date(current.expires_at) > new Date());
      if (!stillActive) {
        // Vencida mas não revogada: fecha antes de abrir a nova (índice único
        // permite uma ativa por plano).
        if (current) {
          await supabase.from("memberships").update({ revoked_at: now }).eq("id", current.id);
        }
        const { error } = await supabase.from("memberships").insert({
          user_id: user.id,
          plan: "completo",
          source: event.source,
          granted_at: now,
          reason: `compra via ${event.platform} (${event.transactionId})`,
        });
        if (error) console.error(`${log} Erro ao registrar Handify Completo:`, error.message);
        else console.info(`${log} Handify Completo concedido: user=${user.id}`);
      }

      // Todo curso marcado `in_plan` entra na compra do plano — inclusive os que
      // não carregam o código do plano nos checkout_codes (cursos novos). Os
      // que carregam já foram matriculados acima.
      const jaTratados = new Set(courses.map((c) => c.id));
      const { data: doPlano } = await supabase
        .from("courses")
        .select("id, access_days")
        .eq("in_plan", true);
      const faltando = (doPlano ?? []).filter((c) => !jaTratados.has(c.id));
      if (faltando.length) {
        const { error } = await supabase.from("enrollments").upsert(
          faltando.map((c) => ({
            user_id: user.id,
            course_id: c.id,
            source: event.source,
            granted_at: now,
            expires_at: calcExpiresAt(c.access_days as number | null),
          })),
          { onConflict: "user_id,course_id" }
        );
        if (error) console.error(`${log} Erro nos cursos do plano sem código:`, error.message);
        else console.info(`${log} +${faltando.length} curso(s) do plano sem código: user=${user.id}`);
      }
    } else if (current) {
      await supabase.from("memberships").update({ revoked_at: now }).eq("id", current.id);
      await supabase.from("audit_log").insert({
        admin_id: null,
        action: "membership.revoked",
        target_type: "membership",
        target_id: current.id,
        meta: {
          user_id: user.id,
          reason: event.eventType,
          platform: event.platform,
          transaction_id: event.transactionId,
        },
      });
      console.info(`${log} Handify Completo revogado: user=${user.id} motivo=${event.eventType}`);
    }
  }

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
      courses.find((c) => hasCode(c.checkout_codes as string[], event.mainProductCode)) ??
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
