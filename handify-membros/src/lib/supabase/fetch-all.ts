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
      // Antes isto era um `break`: uma página que falhasse devolvia o que já
      // tinha vindo como se fosse a lista inteira. É o mesmo mal que a função
      // existe para curar — um recorte passando por total — só que mais difícil
      // de ver, porque o número não fica redondo em 1.000. Quem chama precisa
      // saber que não deu para ler tudo.
      const mensagem = error instanceof Error ? error.message : String(error);
      throw new Error(`[fetchAll] falhou na página que começa em ${de}: ${mensagem}`);
    }
    if (!data?.length) break;

    linhas.push(...data);

    // Página incompleta = acabou. Evita uma requisição extra sempre.
    if (data.length < tamanhoDaPagina) break;
  }

  if (linhas.length >= maximo) {
    // Bater no teto também é resultado parcial. Silenciar aqui seria repetir o
    // problema um zero adiante.
    throw new Error(
      `[fetchAll] parei no limite de ${maximo} linhas — a consulta devolve mais do que isso`
    );
  }

  return linhas;
}
