import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Tier } from "@/types";

/**
 * Quem está pedindo, e se é admin.
 *
 * Admin tem acesso a todos os cursos — os de hoje e os que forem criados
 * depois. A regra vive aqui e em `public.is_enrolled()` no banco (usada pelas
 * policies de RLS); as duas precisam concordar.
 *
 * Não criamos matrícula para o admin de propósito: ela entraria nas métricas,
 * na taxa de conclusão e na contagem de alunas, e teria que ser refeita a cada
 * curso novo.
 */
export async function getViewer(): Promise<{ userId: string | null; isAdmin: boolean }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { userId: null, isAdmin: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return { userId: user.id, isAdmin: profile?.role === "admin" };
}

export type { Tier };

/**
 * Esta aluna tem o Handify Completo ativo?
 *
 * O plano é uma entidade própria (`memberships`), não a soma dos cursos: quem
 * comprou os 23 itens separados NÃO é Completo. Espelha
 * `public.has_active_membership()` no banco — os dois precisam concordar.
 * Contexto em .claude/plans/tiers-handify.md.
 */
export async function hasActiveMembership(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_id", userId)
    .eq("plan", "completo")
    .is("revoked_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .limit(1)
    .maybeSingle();
  return !!data;
}

/**
 * Tier da pessoa logada — derivado, nunca armazenado, para não desatualizar
 * quando o plano vence. Espelha `public.current_tier()` no banco.
 */
export async function getTier(): Promise<Tier> {
  const { userId, isAdmin } = await getViewer();
  if (!userId) return "visitante";
  if (isAdmin) return "admin";
  if (await hasActiveMembership(userId)) return "completo";

  const supabase = await createClient();
  const { data } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", userId)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .limit(1)
    .maybeSingle();
  return data ? "aluna" : "visitante";
}

/**
 * A pessoa logada pode assistir este curso? Admin sempre pode. Espelha
 * `public.is_enrolled()` no banco — os dois precisam concordar.
 *
 * Handify Completo: curso marcado `in_plan` é dela mesmo sem matrícula — é
 * assim que curso novo entra no plano sozinho, sem colar o código do plano em
 * cada curso nem refazer matrículas. A matrícula é criada aqui, no primeiro
 * acesso (source `subscription`), porque progresso, conclusão e certificado
 * saem dela.
 */
export async function hasCourseAccess(courseId: string): Promise<boolean> {
  const { userId, isAdmin } = await getViewer();
  if (!userId) return false;
  if (isAdmin) return true;

  const supabase = await createClient();
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .maybeSingle();
  if (enrollment) return true;

  if (!(await hasActiveMembership(userId))) return false;

  const service = createServiceClient();
  const { data: course } = await service
    .from("courses")
    .select("in_plan")
    .eq("id", courseId)
    .maybeSingle();
  if (!course?.in_plan) return false;

  // Vencida (plano revogado e devolvido) ou inexistente — vira ativa agora.
  const { error } = await service.from("enrollments").upsert(
    {
      user_id: userId,
      course_id: courseId,
      source: "subscription",
      granted_at: new Date().toISOString(),
      expires_at: null,
    },
    { onConflict: "user_id,course_id" }
  );
  if (error) console.error("[access] matrícula do plano no primeiro acesso:", error.message);
  return true;
}

/**
 * Todos os cursos que esta pessoa pode abrir — matrícula, plano ou admin.
 *
 * Existe porque a regra de acesso mora em três caminhos desde 03/09, e várias
 * telas conheciam só o primeiro. Em 10/09 os materiais da aula apareciam como
 * "Indisponível" para a admin e para quem tem o plano sem ter aberto o curso
 * ainda, porque a consulta de assinatura olhava direto em `enrollments`.
 *
 * Sempre que uma tela precisar da LISTA de cursos acessíveis, use isto em vez
 * de consultar `enrollments` na mão — assim a regra muda num lugar só.
 */
export async function getAccessibleCourseIds(): Promise<string[]> {
  const { userId, isAdmin } = await getViewer();
  if (!userId) return [];

  const service = createServiceClient();

  if (isAdmin) {
    const { data } = await service.from("courses").select("id");
    return (data ?? []).map((c) => c.id as string);
  }

  const { data: matriculas } = await service
    .from("enrollments")
    .select("course_id")
    .eq("user_id", userId)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  const ids = new Set((matriculas ?? []).map((e) => e.course_id as string));

  if (await hasActiveMembership(userId)) {
    const { data: doPlano } = await service.from("courses").select("id").eq("in_plan", true);
    for (const c of doPlano ?? []) ids.add(c.id as string);
  }

  return [...ids];
}
