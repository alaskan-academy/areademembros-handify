/**
 * `%` e `_` são curingas do LIKE/ILIKE no Postgres, e `\` é o escape padrão.
 * Sem escapar, o `_` de josi_rios123@gmail.com casa com QUALQUER caractere
 * naquela posição — o padrão deixa de ser o endereço da aluna e vira uma
 * família de endereços. São 232 perfis com `_` no e-mail.
 *
 * Nota: o PostgREST trata `*` como apelido de `%` nos operadores like/ilike e
 * faz a troca antes de chegar ao SQL, então um `*` digitado na busca continua
 * funcionando como curinga e não dá para escapar por aqui. Hoje não existe
 * e-mail nem título com `*` no banco; se virar problema, filtre o `*` no termo
 * de busca, não neste helper.
 */
export function escaparCuringas(valor: string): string {
  return valor.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Padrão "contém" pronto para `.ilike(coluna, padraoContem(termo))`. */
export function padraoContem(termo: string): string {
  return `%${escaparCuringas(termo)}%`;
}

/**
 * Fragmento `coluna.ilike."%termo%"` para usar dentro de `.or(...)`.
 *
 * Dentro do `or()` do PostgREST a vírgula, o ponto e os parênteses separam
 * filtros — por isso o valor vai entre aspas duplas. E dentro das aspas o
 * PostgREST desfaz `\\` e `\"`, então a barra que o escaparCuringas acabou de
 * pôr precisa ser dobrada, senão ela some antes de chegar no SQL.
 */
export function filtroOrIlike(coluna: string, termo: string): string {
  const v = escaparCuringas(termo).replace(/["\\]/g, (c) => `\\${c}`);
  return `${coluna}.ilike."%${v}%"`;
}
