import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getViewer, hasActiveMembership } from "@/lib/auth/access";
import type { Tier } from "@/types";
import type { NichoView, ToolPreview, ToolSection, ToolState, ToolTier, ToolView, ViewerTools } from "./types";

/**
 * Quem vê o quê na área Ferramentas.
 *
 * A lista vem da tabela `tools` (a admin edita sem deploy). A regra de acesso,
 * espelhada no comentário da migration `20260903_tools.sql`:
 *   visitante → qualquer conta
 *   aluna     → membership ativa OU matrícula ativa em curso de uma das
 *               categorias da ferramenta (sem categoria = qualquer curso)
 *   completo  → membership ativa
 * Ferramenta trancada não some: devolve o estado e o `preview` para a tela
 * mostrar o resultado borrado e o caminho. Ver .claude/plans/tiers-handify.md.
 */

// As calculadoras são por produto (sabonetes ou velas). Categorias vizinhas
// caem no lado da saboaria — é o mais próximo do que elas fazem.
const CATEGORIA_PARA_NICHO: Record<string, string> = {
  "saboaria-artesanal": "saboaria-artesanal",
  "cosmeticos-artesanais": "saboaria-artesanal",
  "aromas-e-casa": "saboaria-artesanal",
  "velas-artesanais": "velas-artesanais",
};

type ToolRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  section: ToolSection;
  min_tier: ToolTier;
  href: string | null;
  coming_soon: boolean;
  show_in_hub: boolean;
  preview: ToolPreview[] | null;
  tool_categories: { category: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null }[] | null;
};

function umOuPrimeiro<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export async function getToolsForViewer(): Promise<ViewerTools> {
  const { userId, isAdmin } = await getViewer();
  const service = createServiceClient();
  const supabase = await createClient();
  const now = new Date().toISOString();

  const [{ data: toolRows }, { data: nicheRows }, { data: promo }, { data: enrollRows }, membership] =
    await Promise.all([
      service
        .from("tools")
        .select(
          "id, slug, name, description, icon, section, min_tier, href, coming_soon, show_in_hub, preview, tool_categories(category:categories(id, name, slug))"
        )
        .eq("active", true)
        .order("position"),
      service.from("niches").select("id, name, slug").order("position"),
      service.from("annual_promo").select("link_url").eq("active", true).maybeSingle(),
      userId
        ? supabase
            .from("enrollments")
            .select("course:courses(category_id, category:categories(slug))")
            .eq("user_id", userId)
            .or(`expires_at.is.null,expires_at.gt.${now}`)
        : Promise.resolve({ data: [] as unknown[] }),
      userId ? hasActiveMembership(userId) : Promise.resolve(false),
    ]);

  // Categorias dos cursos que ela tem — é isso que abre ferramenta de aluna.
  const categoriasDela = new Set<string>();
  const categoriasSlugs = new Set<string>();
  const contagemNicho = new Map<string, number>();
  for (const row of (enrollRows ?? []) as unknown[]) {
    const course = umOuPrimeiro((row as { course?: unknown }).course) as
      | { category_id: string | null; category: { slug: string } | { slug: string }[] | null }
      | null;
    if (!course) continue;
    if (course.category_id) categoriasDela.add(course.category_id);
    const slug = umOuPrimeiro(course.category)?.slug;
    if (slug) categoriasSlugs.add(slug);
    const nicho = slug ? CATEGORIA_PARA_NICHO[slug] : undefined;
    if (nicho) contagemNicho.set(nicho, (contagemNicho.get(nicho) ?? 0) + 1);
  }
  const temAlgumCurso = (enrollRows ?? []).length > 0;

  const tier: Tier = isAdmin ? "admin" : membership ? "completo" : temAlgumCurso ? "aluna" : "visitante";

  // Nicho principal: o que ela mais faz; empate ou nada → saboaria (o maior
  // público). É só para montar a rota das calculadoras que são por produto.
  const niches = (nicheRows ?? []) as { id: string; name: string; slug: string }[];
  const nichoPrincipal =
    [...contagemNicho.entries()].sort((a, b) => b[1] - a[1] || (a[0] === "saboaria-artesanal" ? -1 : 1))[0]?.[0] ??
    (niches.find((n) => n.slug === "saboaria-artesanal") ?? niches[0])?.slug ??
    "saboaria-artesanal";
  const nichoPrincipalId = niches.find((n) => n.slug === nichoPrincipal)?.id ?? "";

  const nichos: NichoView[] = niches.map((n) => ({
    ...n,
    ativo: contagemNicho.has(n.slug),
  }));

  const tools: ToolView[] = ((toolRows ?? []) as unknown as ToolRow[]).map((t) => {
    const cats = (t.tool_categories ?? [])
      .map((tc) => umOuPrimeiro(tc.category))
      .filter((c): c is { id: string; name: string; slug: string } => !!c);

    let state: ToolState;
    if (t.coming_soon) state = "em_breve";
    else if (isAdmin || membership || t.min_tier === "visitante") state = "aberta";
    else if (t.min_tier === "completo") state = "com_completo";
    else if (cats.length === 0) state = temAlgumCurso ? "aberta" : "com_curso";
    else state = cats.some((c) => categoriasDela.has(c.id)) ? "aberta" : "com_categoria";

    const href = t.href
      ? t.href.replaceAll("{nicho_id}", nichoPrincipalId).replaceAll("{nicho}", nichoPrincipal)
      : null;

    return {
      slug: t.slug,
      name: t.name,
      description: t.description,
      icon: t.icon,
      section: t.section,
      minTier: t.min_tier,
      href,
      comingSoon: t.coming_soon,
      showInHub: t.show_in_hub,
      preview: Array.isArray(t.preview) ? t.preview : [],
      state,
      unlockCategories: cats.map((c) => c.name).sort(),
    };
  });

  return { tier, tools, nichos, categorias: [...categoriasSlugs], planLink: promo?.link_url ?? null };
}

/**
 * Trava de rota: a página da ferramenta chama isto antes de renderizar. Sem
 * isso o cadeado da lista seria só cosmético — bastava saber a URL.
 */
export async function assertToolAccess(slug: string): Promise<ViewerTools> {
  const dados = await getToolsForViewer();
  const tool = dados.tools.find((t) => t.slug === slug);
  if (!tool) redirect("/ferramentas");
  if (tool.state !== "aberta") redirect(`/ferramentas?bloqueada=${encodeURIComponent(slug)}`);
  return dados;
}
