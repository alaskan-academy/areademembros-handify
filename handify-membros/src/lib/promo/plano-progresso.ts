import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { hasActiveMembership } from "@/lib/auth/access";
import type { PlanProgressData } from "@/components/promo/PlanProgressCard";

/**
 * Quantos cursos do Handify Completo esta aluna já tem, de quantos.
 *
 * Alimenta o card "Você já tem X de N" no painel, na página do curso concluído
 * e nos certificados — o mesmo cálculo nos três lugares, para os números nunca
 * divergirem. Devolve null quando não há o que oferecer: promo desligada, aluna
 * já tem o plano, ou nenhum curso publicado com o código do plano.
 *
 * Service client para contar os cursos do plano porque só pegamos ids — a
 * policy de `courses` não é o ponto aqui. As matrículas vêm com o cliente da
 * própria aluna (RLS: só as dela).
 */
export async function getPlanoProgresso(userId: string): Promise<PlanProgressData | null> {
  const service = createServiceClient();
  const [{ data: promo }, temPlano] = await Promise.all([
    service
      .from("annual_promo")
      .select("active, link_url, button_text")
      .eq("active", true)
      .maybeSingle(),
    hasActiveMembership(userId),
  ]);
  if (!promo?.link_url || temPlano) return null;

  // O que faz parte do plano é a flag `in_plan` do curso, não o código colado.
  const { data: cursosDoPlano } = await service
    .from("courses")
    .select("id")
    .eq("published", true)
    .eq("in_plan", true);
  const ids = (cursosDoPlano ?? []).map((c) => c.id);
  if (!ids.length) return null;

  const supabase = await createClient();
  const { count } = await supabase
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("course_id", ids)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  return {
    temDoPlano: count ?? 0,
    totalDoPlano: ids.length,
    linkUrl: promo.link_url as string,
    buttonText: promo.button_text as string | null,
  };
}
