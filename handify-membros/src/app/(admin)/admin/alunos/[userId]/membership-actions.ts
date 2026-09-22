"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { sendAccessConfirmedEmail } from "@/lib/email";
import { getAdminId } from "./actions";

/**
 * Dar e revogar o Handify Completo na mão.
 *
 * Existe porque webhook falha, bônus acontece e reembolso às vezes é acordo. Até
 * aqui "dar o Completo" era marcar 23 checkboxes em "Dar acesso em lote" — e o
 * sistema continuava sem saber que aquela aluna tinha o plano.
 *
 * A membership é a fonte da verdade do plano; as matrículas dos cursos são a
 * consequência. Todas nascem com o mesmo `granted_at` da membership, e é por esse
 * carimbo que a revogação sabe o que veio junto com o plano e o que a aluna
 * comprou separado (e fica). Contexto em .claude/plans/tiers-handify.md.
 */

export type MembershipActionState = { error?: string; success?: string };

type Service = ReturnType<typeof createServiceClient>;

/** Cursos que fazem parte do plano: a flag `in_plan`, marcada pela admin no curso. */
async function cursosDoPlano(service: Service) {
  const { data } = await service
    .from("courses")
    .select("id, title, slug")
    .eq("in_plan", true)
    .order("position");
  return (data ?? []) as { id: string; title: string; slug: string }[];
}

// ─── Dar ─────────────────────────────────────────────────────────────────────

const grantSchema = z.object({
  user_id: z.string().uuid(),
  reason: z.string().min(1, "Informe o motivo"),
  source: z.enum(["manual", "bonus"]).default("manual"),
  expires_at: z.string().optional(),
});

export async function grantMembershipAction(
  _prev: MembershipActionState,
  formData: FormData
): Promise<MembershipActionState> {
  let adminId: string;
  try {
    adminId = await getAdminId();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const parsed = grantSchema.safeParse({
    user_id: formData.get("user_id"),
    reason: formData.get("reason"),
    source: formData.get("source") || "manual",
    expires_at: formData.get("expires_at") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { user_id, reason, source, expires_at } = parsed.data;

  const service = createServiceClient();
  const now = new Date().toISOString();
  const expiresAt = expires_at ? new Date(expires_at).toISOString() : null;

  const { data: current } = await service
    .from("memberships")
    .select("id, expires_at")
    .eq("user_id", user_id)
    .eq("plan", "completo")
    .is("revoked_at", null)
    .maybeSingle();
  if (current) {
    const ativa = !current.expires_at || new Date(current.expires_at) > new Date();
    if (ativa) return { error: "Esta aluna já tem o Handify Completo ativo." };
    // Vencida mas não revogada: fecha antes de abrir a nova.
    await service.from("memberships").update({ revoked_at: now }).eq("id", current.id);
  }

  const { data: membership, error: memErr } = await service
    .from("memberships")
    .insert({
      user_id,
      plan: "completo",
      source,
      granted_at: now,
      expires_at: expiresAt,
      granted_by: adminId,
      reason,
    })
    .select("id")
    .single();
  if (memErr || !membership) {
    return { error: `Erro ao dar o Handify Completo: ${memErr?.message ?? "sem retorno"}` };
  }

  // Matrículas nos cursos do plano. O que a aluna já tinha ativo fica como está
  // (comprou separado — não é do plano e não sai com ele).
  // Se uma matrícula falha, a falha não pode morrer no console. Antes ela morria:
  // as 23 podiam falhar e a admin lia "Handify Completo concedido" em verde, sem
  // saber que a aluna não veria curso nenhum no painel (dashboard e /cursos listam
  // por enrollments, não pela membership). Pior na matrícula vencida: o delete
  // abaixo acontece ANTES do insert, então um insert que falha deixa a aluna sem
  // linha nenhuma para aquele curso — estado pior do que antes da ação rodar.
  // Agora toda falha vai junto com o nome do curso para o audit_log e para a tela.
  const cursos = await cursosDoPlano(service);
  let liberados = 0;
  let jaTinha = 0;
  const falhas: { id: string; title: string; erro: string }[] = [];
  let primeiroLiberado: { slug: string } | null = null;
  for (const curso of cursos) {
    const { data: existing } = await service
      .from("enrollments")
      .select("id, expires_at")
      .eq("user_id", user_id)
      .eq("course_id", curso.id)
      .maybeSingle();
    let apagouVencida = false;
    if (existing) {
      const ativa = !existing.expires_at || new Date(existing.expires_at) > new Date();
      if (ativa) {
        jaTinha++;
        continue;
      }
      const { error: delErr } = await service.from("enrollments").delete().eq("id", existing.id);
      if (delErr) {
        console.error("[grantMembership] delete vencida:", curso.id, delErr.message);
        falhas.push({ id: curso.id, title: curso.title, erro: delErr.message });
        continue;
      }
      apagouVencida = true;
    }
    const { error } = await service.from("enrollments").insert({
      user_id,
      course_id: curso.id,
      source: "manual",
      granted_at: now,
      expires_at: expiresAt,
    });
    if (error) {
      console.error("[grantMembership] matrícula:", curso.id, error.message);
      falhas.push({
        id: curso.id,
        title: curso.title,
        erro: apagouVencida
          ? `${error.message} (a matrícula vencida anterior foi apagada)`
          : error.message,
      });
    } else {
      liberados++;
      if (!primeiroLiberado) primeiroLiberado = { slug: curso.slug };
    }
  }

  await service.from("audit_log").insert({
    admin_id: adminId,
    action: "membership.granted",
    target_type: "membership",
    target_id: membership.id,
    meta: {
      user_id,
      reason,
      source,
      expires_at: expiresAt,
      courses_granted: liberados,
      courses_already_had: jaTinha,
      // Sem isto, reprocessar depois é adivinhar quais cursos ficaram de fora.
      courses_failed: falhas.length,
      failed_courses: falhas.map((f) => ({ id: f.id, title: f.title, erro: f.erro })),
    },
  });

  // Um e-mail só, não 23. O link do e-mail aponta para um curso pelo slug, então
  // o slug precisa ser de um curso que REALMENTE entrou: com `cursos[0]` a aluna
  // podia receber o link justo do curso que falhou e bater na porta fechada.
  if (liberados > 0 && primeiroLiberado) {
    ;(async () => {
      const { data: profile } = await service
        .from("profiles")
        .select("email, full_name")
        .eq("id", user_id)
        .single();
      if (profile?.email) {
        await sendAccessConfirmedEmail({
          to: profile.email,
          studentName: profile.full_name ?? profile.email,
          courseTitle: "Handify Completo",
          courseSlug: primeiroLiberado.slug,
          totalCourses: liberados,
        });
      }
    })().catch((e) => console.error("[grantMembership] email:", e));
  }

  // O revalidatePath vale para os dois casos: a membership foi criada mesmo quando
  // alguma matrícula falhou, e a tela precisa recarregar.
  revalidatePath(`/admin/alunos/${user_id}`);

  // Parcial volta como `error`, não como `success`: a tela pinta de vermelho pelo
  // campo (aluna-detail.tsx), e a admin precisa mesmo agir — sem a matrícula a
  // aluna não vê o curso no painel dela. O texto abre dizendo que o plano ficou
  // ativo para ela não tentar dar de novo e esbarrar em "já tem o Completo ativo".
  if (falhas.length) {
    const nomes = falhas.map((f) => f.title).join(", ");
    const plural = falhas.length !== 1;
    return {
      error: `Handify Completo concedido (o plano está ativo), mas ${falhas.length} curso${plural ? "s" : ""} não entrou${plural ? "ram" : ""}: ${nomes}. ${liberados} liberado${liberados !== 1 ? "s" : ""}${jaTinha ? `, ${jaTinha} já tinha` : ""}. Libere ${plural ? "esses cursos" : "esse curso"} por "Dar acesso em lote" — a aluna não vê no painel dela sem a matrícula.`,
    };
  }

  return {
    success: `Handify Completo concedido — ${liberados} curso${liberados !== 1 ? "s" : ""} liberado${liberados !== 1 ? "s" : ""}${
      jaTinha ? `, ${jaTinha} já tinha` : ""
    }.`,
  };
}

// ─── Revogar ─────────────────────────────────────────────────────────────────

const revokeSchema = z.object({
  user_id: z.string().uuid(),
  membership_id: z.string().uuid(),
  reason: z.string().min(1, "Informe o motivo"),
});

export async function revokeMembershipAction(
  _prev: MembershipActionState,
  formData: FormData
): Promise<MembershipActionState> {
  let adminId: string;
  try {
    adminId = await getAdminId();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const parsed = revokeSchema.safeParse({
    user_id: formData.get("user_id"),
    membership_id: formData.get("membership_id"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { user_id, membership_id, reason } = parsed.data;

  const service = createServiceClient();
  const now = new Date().toISOString();

  const { data: membership } = await service
    .from("memberships")
    .select("id, granted_at, revoked_at")
    .eq("id", membership_id)
    .eq("user_id", user_id)
    .maybeSingle();
  if (!membership) return { error: "Membership não encontrada." };
  if (membership.revoked_at) return { error: "Este Handify Completo já estava revogado." };

  await service.from("memberships").update({ revoked_at: now }).eq("id", membership.id);

  // Expira só o que veio junto com o plano (mesmo granted_at). Curso comprado
  // separado tem outro carimbo e fica.
  const cursos = await cursosDoPlano(service);
  let expirados = 0;
  if (cursos.length) {
    const { data: revoked } = await service
      .from("enrollments")
      .update({ expires_at: now })
      .eq("user_id", user_id)
      .eq("granted_at", membership.granted_at)
      .in(
        "course_id",
        cursos.map((c) => c.id)
      )
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .select("id");
    expirados = revoked?.length ?? 0;
  }

  await service.from("audit_log").insert({
    admin_id: adminId,
    action: "membership.revoked",
    target_type: "membership",
    target_id: membership.id,
    meta: { user_id, reason, courses_expired: expirados },
  });

  revalidatePath(`/admin/alunos/${user_id}`);
  return {
    success: `Handify Completo revogado — ${expirados} curso${expirados !== 1 ? "s" : ""} do plano encerrado${expirados !== 1 ? "s" : ""}.`,
  };
}
