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

const TIERS = ["visitante", "aluna", "completo", "admin"] as const;

/**
 * O tier tem de ser um dos quatro, sempre. Não é higiene de tipo: o valor é
 * portão de acesso, e `createClient()` não tem o genérico `Database`, então o
 * `.rpc()` devolve `any`. Escrever `data as Tier` sem conferir deixaria um
 * `null` passar por tier — e aí `tier === 'visitante'` dá false em
 * `comunidade/forum`, `inspiracoes` e `inspiracoes/salvos`, o muro "só para
 * alunas" não aparece, e a página abre para quem não devia. Falha ABERTA.
 */
function ehTier(v: unknown): v is Tier {
  return typeof v === "string" && (TIERS as readonly string[]).includes(v);
}

/**
 * Tier da pessoa logada — derivado, nunca armazenado, para não desatualizar
 * quando o plano vence.
 *
 * Uma ida ao banco, não quatro. `public.current_tier()` já fazia exatamente
 * esta conta em SQL desde `20260903_memberships.sql:64` — era só ninguém estar
 * chamando. Medido em 24/09/2026: o trabalho de cada consulta é de 0 a 6 ms; o
 * que pesava era o número de IDAS, e cada ida custa uma latência inteira.
 * Provado antes de trocar: rodei `current_tier()` com o JWT de cada um dos
 * 4.723 perfis reais e comparei com a árvore do TypeScript abaixo — 4.538
 * `aluna`, 106 `visitante`, 78 `completo`, 1 `admin`, zero divergência.
 *
 * `.rpc()` NUNCA lança: devolve `{ data, error }` em todo modo de falha. Por
 * isso o erro cai no caminho antigo em vez de virar 'visitante' mudo — um
 * 'visitante' errado no layout tira os itens do menu, devolve a oferta do plano
 * a quem já pagou e troca três páginas pelo muro, em toda navegação.
 *
 * Sem sessão nenhuma a RPC responde 42501 (o grant é para `authenticated`, não
 * para `anon` — `20260903_memberships.sql:208`). Nenhum chamador de hoje cai
 * nisso (os quatro fazem `getUser()` antes), e se cair, o caminho antigo
 * devolve 'visitante' como sempre devolveu.
 */
export async function getTier(): Promise<Tier> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("current_tier");

  if (!error && ehTier(data)) return data;

  console.error(
    "[access] current_tier não respondeu, caindo no caminho antigo:",
    error?.message ?? `valor inesperado ${JSON.stringify(data)}`
  );
  return tierPorConsulta();
}

/** O caminho antigo, de quatro idas. Fica como rede de segurança do `getTier`. */
async function tierPorConsulta(): Promise<Tier> {
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
