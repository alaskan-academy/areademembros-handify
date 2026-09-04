/**
 * Estoque de insumos — o que é compartilhado entre a tela e as actions
 * (constantes e contas puras; "use server" só pode exportar funções async).
 */

export const CATEGORIAS = ["cera", "base", "oleo", "essencia", "corante", "aditivo", "embalagem", "pavio", "outros"] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export const CATEGORIA_NOME: Record<Categoria, string> = {
  cera: "Cera",
  base: "Base glicerinada",
  oleo: "Óleo ou manteiga",
  essencia: "Essência ou óleo essencial",
  corante: "Corante e mica",
  aditivo: "Aditivo (conservante, vitamina E…)",
  embalagem: "Embalagem e rótulo",
  pavio: "Pavio",
  outros: "Outros",
};

export const UNIDADES = ["g", "kg", "mL", "L", "un"] as const;
export type Unidade = (typeof UNIDADES)[number];

const fmt = (n: number, casas = 1) => n.toLocaleString("pt-BR", { maximumFractionDigits: casas });

/** 1200 g vira "1,2 kg"; 250 g fica "250 g"; 12 un fica "12 un". */
export function qtdTexto(q: number, u: Unidade): string {
  if (u === "g" && q >= 1000) return `${fmt(q / 1000, 2)} kg`;
  if (u === "mL" && q >= 1000) return `${fmt(q / 1000, 2)} L`;
  return `${fmt(q, q < 10 ? 2 : 1)} ${u}`;
}

/** "R$ 4,50 por 100 g" — por 100 nas unidades pequenas, por 1 nas grandes. */
export function custoTexto(cost: number | null, cost_quantity: number | null, u: Unidade): string | null {
  if (cost == null || !cost_quantity) return null;
  const porUnidade = cost / cost_quantity;
  const base = u === "g" || u === "mL" ? 100 : 1;
  const valor = porUnidade * base;
  return `R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} por ${base === 1 ? "" : "100 "}${u}`;
}

export function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function diasAte(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const [hy, hm, hd] = hojeISO().split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(hy, hm - 1, hd)) / 86400000);
}

export type Situacao = { acabando: boolean; zerado: boolean; validade: "vencido" | "perto" | null; dias: number | null };

/** Acabando = abaixo do mínimo (ou zerado); vencendo = 30 dias ou já venceu. */
export function situacao(i: { quantity: number; min_quantity: number | null; expires_at: string | null }): Situacao {
  const zerado = i.quantity <= 0;
  const acabando = zerado || (i.min_quantity != null && i.min_quantity > 0 && i.quantity <= i.min_quantity);
  const dias = i.expires_at ? diasAte(i.expires_at) : null;
  const validade = dias == null ? null : dias < 0 ? "vencido" : dias <= 30 ? "perto" : null;
  return { acabando, zerado, validade, dias };
}
