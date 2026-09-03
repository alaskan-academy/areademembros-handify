import "server-only";

/**
 * O Supabase devolve no máximo 1.000 linhas por consulta — e não avisa quando
 * corta. Qualquer contagem feita somando as linhas recebidas fica errada assim
 * que a tabela passa desse tamanho, sem nenhum erro aparecer.
 *
 * Foi o que aconteceu aqui: as métricas do admin mostravam 931 compradoras
 * quando havia 3.157, e o envio de push alcançava 1.000 das 1.114 inscrições.
 *
 * Esta função pagina até o fim.
 *
 * ```ts
 * const inscricoes = await fetchAll((de, ate) =>
 *   service.from("push_subscriptions").select("endpoint, p256dh, auth").range(de, ate)
 * );
 * ```
 *
 * Para só contar, prefira `count: "exact", head: true` — é uma consulta só e
 * não traz linha nenhuma. Esta aqui é para quando você precisa das linhas.
 */
export async function fetchAll<T>(
  consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  { tamanhoDaPagina = 1000, maximo = 100_000 }: { tamanhoDaPagina?: number; maximo?: number } = {}
): Promise<T[]> {
  const linhas: T[] = [];

  for (let de = 0; de < maximo; de += tamanhoDaPagina) {
    const { data, error } = await consulta(de, de + tamanhoDaPagina - 1);

    if (error) {
      console.error("[fetchAll] falhou na página que começa em", de, error);
      break;
    }
    if (!data?.length) break;

    linhas.push(...data);

    // Página incompleta = acabou. Evita uma requisição extra sempre.
    if (data.length < tamanhoDaPagina) break;
  }

  return linhas;
}
