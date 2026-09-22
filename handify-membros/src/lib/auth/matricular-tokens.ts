import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Transforma token de ativação em matrícula, queimando o token SÓ quando a
 * matrícula entrou.
 *
 * Existe porque o padrão errado estava copiado em quatro lugares: o upsert em
 * `enrollments` ia dentro de um `Promise.all`, o erro de cada um era descartado,
 * e logo depois um único `update({ used: true }).eq("email", ...)` queimava
 * TODOS os tokens daquele e-mail — inclusive os cursos que não entraram.
 *
 * O estrago de uma matrícula que falha em silêncio é duplo:
 *
 * 1. a aluna fica sem o curso e o link de ativação passa a responder "já foi
 *    utilizado", então ela não tem como se resolver sozinha;
 * 2. ela some do relatório diário de compras sem acesso, que parte de
 *    `activation_tokens where not used` — o único lugar que a pegaria.
 *
 * Token preservado é o oposto: a aluna ainda consegue usar o link, e o alarme
 * enxerga o caso no dia seguinte.
 */
export type ResultadoMatricula = {
  /** Cursos que entraram e cujos tokens foram queimados. */
  concedidas: number;
  /** course_id dos que falharam — token intacto, visível para o alarme. */
  falharam: string[];
};

export async function matricularTokensPendentes(
  service: SupabaseClient,
  userId: string,
  tokens: { token: string; course_id: string | null }[]
): Promise<ResultadoMatricula> {
  const agora = new Date().toISOString();
  let concedidas = 0;
  const falharam: string[] = [];

  // Em série, de propósito: cada token precisa do resultado do seu próprio
  // upsert antes de ser queimado, e são poucos por compra (23 no maior pacote).
  for (const t of tokens) {
    if (!t.course_id) continue;

    const { error: erroMatricula } = await service.from("enrollments").upsert(
      {
        user_id: userId,
        course_id: t.course_id,
        source: "payt",
        granted_at: agora,
        expires_at: null,
      },
      { onConflict: "user_id,course_id" }
    );

    if (erroMatricula) {
      falharam.push(t.course_id);
      console.error(
        `[matricular] falhou, token preservado: user=${userId} curso=${t.course_id}`,
        erroMatricula.message
      );
      continue;
    }

    const { error: erroToken } = await service
      .from("activation_tokens")
      .update({ used: true })
      .eq("token", t.token);

    if (erroToken) {
      // A matrícula entrou; o token sobrevivendo só faz o caso aparecer no
      // relatório de amanhã, e lá a admin vê que o acesso já está lá.
      console.error(`[matricular] token nao marcado como usado: ${t.token}`, erroToken.message);
    }
    concedidas++;
  }

  return { concedidas, falharam };
}
