import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/access";
import { createServiceClient } from "@/lib/supabase/service";
import FerramentasAdmin, { type ToolAdminRow, type CategoriaOpcao } from "./ferramentas-admin";

export const metadata = { title: "Ferramentas — Admin Handify" };

export default async function FerramentasAdminPage() {
  const { isAdmin } = await getViewer();
  if (!isAdmin) redirect("/");

  const service = createServiceClient();
  const [{ data: tools }, { data: categories }] = await Promise.all([
    service
      .from("tools")
      .select(
        "id, slug, name, description, icon, section, min_tier, href, coming_soon, active, position, tool_categories(category_id)"
      )
      .order("section")
      .order("position"),
    service.from("categories").select("id, name, slug").order("name"),
  ]);

  const rows: ToolAdminRow[] = (tools ?? []).map((t) => {
    const row = t as unknown as ToolAdminRow & { tool_categories: { category_id: string }[] | null };
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      icon: row.icon,
      section: row.section,
      min_tier: row.min_tier,
      href: row.href,
      coming_soon: row.coming_soon,
      active: row.active,
      position: row.position,
      category_ids: (row.tool_categories ?? []).map((c) => c.category_id),
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ferramentas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Quem abre cada ferramenta: o tier mínimo e, para as de aluna, as categorias de curso que
          liberam. O que você mudar aqui vale na hora, sem deploy.
        </p>
      </div>
      <FerramentasAdmin tools={rows} categorias={(categories ?? []) as CategoriaOpcao[]} />
    </div>
  );
}
