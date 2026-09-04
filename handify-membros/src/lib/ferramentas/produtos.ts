/**
 * O que aparece DENTRO de cada ferramenta segue o curso que ela comprou —
 * a mesma regra que abre a ferramenta na porta. Puro, para testar.
 */

export type ProdutoBase = "sabonetes" | "velas";

/** Categoria do curso → produto das calculadoras por produto (lucro, essências, Minha receita). */
export const PRODUTO_POR_CATEGORIA: Record<string, ProdutoBase[]> = {
  "saboaria-artesanal": ["sabonetes"],
  "cosmeticos-artesanais": ["sabonetes"],
  "velas-artesanais": ["velas"],
  "aromas-e-casa": ["velas"],
};

/** Completo e admin veem tudo; aluna vê o que os cursos dela liberam. */
export function produtosLiberados(categorias: string[], tudo: boolean): ProdutoBase[] {
  if (tudo) return ["sabonetes", "velas"];
  const set = new Set<ProdutoBase>();
  for (const c of categorias) for (const p of PRODUTO_POR_CATEGORIA[c] ?? []) set.add(p);
  return (["sabonetes", "velas"] as ProdutoBase[]).filter((p) => set.has(p));
}

/** Visitante (sem curso) não tem categoria: nas ferramentas gratuitas vê os dois. */
export function produtoPadrao(categorias: string[], tudo: boolean): ProdutoBase {
  const lib = produtosLiberados(categorias, tudo);
  return lib.length === 1 ? lib[0] : "sabonetes";
}
