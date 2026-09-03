import type { Tier } from "@/types";

export type ToolSection = "calcular" | "guardar" | "fornecedores";
export type ToolTier = "visitante" | "aluna" | "completo";

/**
 * Como a ferramenta aparece para quem está olhando.
 * - aberta: abre.
 * - em_breve: ainda não existe (mostra o tier que vai pedir).
 * - com_curso: tier aluna, sem categoria, e ela não tem nenhum curso.
 * - com_categoria: tier aluna com categorias, e ela não tem curso de nenhuma.
 * - com_completo: tier completo e ela não tem o plano.
 * Trancada nunca some: mostra o `preview` borrado e o caminho.
 */
export type ToolState = "aberta" | "em_breve" | "com_curso" | "com_categoria" | "com_completo";

export type ToolPreview = { label: string; value: string };

export type ToolView = {
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  section: ToolSection;
  minTier: ToolTier;
  /** Já com {nicho}/{nicho_id} resolvidos para esta aluna. Null = sem rota. */
  href: string | null;
  comingSoon: boolean;
  preview: ToolPreview[];
  state: ToolState;
  /** Nomes das categorias que liberam — para "Com um curso de Velas". */
  unlockCategories: string[];
};

export type NichoView = { id: string; slug: string; name: string; ativo: boolean };

export type ViewerTools = {
  tier: Tier;
  tools: ToolView[];
  /** Nichos das ferramentas; `ativo` = ela tem curso que mapeia para ele. */
  nichos: NichoView[];
  /** Checkout do Handify Completo, quando a promo está ligada. */
  planLink: string | null;
};
