"use client";

import { useActionState, useState } from "react";
import { Pencil, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateToolAction, type ToolActionState } from "./actions";

export type ToolAdminRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  section: "calcular" | "guardar" | "fornecedores";
  min_tier: "visitante" | "aluna" | "completo";
  href: string | null;
  coming_soon: boolean;
  active: boolean;
  position: number;
  category_ids: string[];
};

export type CategoriaOpcao = { id: string; name: string; slug: string };

const SECAO_LABEL: Record<ToolAdminRow["section"], string> = {
  calcular: "Calcular",
  guardar: "Guardar",
  fornecedores: "Fornecedores",
};

const TIER_LABEL: Record<ToolAdminRow["min_tier"], string> = {
  visitante: "Todas as contas",
  aluna: "Alunas (por categoria)",
  completo: "Só Handify Completo",
};

const TIER_COR: Record<ToolAdminRow["min_tier"], string> = {
  visitante: "bg-muted text-foreground/70",
  aluna: "bg-[#72CF92]/15 text-[#3d9e5a]",
  completo: "bg-[#6699F3]/10 text-[#6699F3]",
};

export default function FerramentasAdmin({
  tools,
  categorias,
}: {
  tools: ToolAdminRow[];
  categorias: CategoriaOpcao[];
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const nomeCategoria = new Map(categorias.map((c) => [c.id, c.name]));

  const porSecao = (["calcular", "guardar", "fornecedores"] as const).map((s) => ({
    secao: s,
    itens: tools.filter((t) => t.section === s),
  }));

  return (
    <div className="space-y-8">
      {porSecao.map(({ secao, itens }) => (
        <section key={secao} className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {SECAO_LABEL[secao]} · {itens.length}
          </h2>
          <div className="handify-card overflow-hidden divide-y divide-border/40">
            {itens.length === 0 && (
              <p className="px-5 py-6 text-sm text-muted-foreground">Nenhuma ferramenta neste grupo.</p>
            )}
            {itens.map((t) => (
              <div key={t.id} className={cn("px-5 py-4", !t.active && "opacity-60")}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#6699F3]/10 flex items-center justify-center text-xl shrink-0">
                    {t.icon ?? "🧰"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{t.name}</p>
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold", TIER_COR[t.min_tier])}>
                        {t.min_tier === "completo" && <Sparkles className="w-3 h-3 inline -mt-0.5 mr-1" />}
                        {TIER_LABEL[t.min_tier]}
                      </span>
                      {t.coming_soon && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-black bg-[#FEC649] text-[#0F0F0F]">
                          Em breve
                        </span>
                      )}
                      {!t.active && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600">
                          Desativada
                        </span>
                      )}
                    </div>
                    {t.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {t.min_tier === "aluna" ? (
                        t.category_ids.length ? (
                          <>
                            Libera com curso de:{" "}
                            <span className="text-foreground">
                              {t.category_ids.map((id) => nomeCategoria.get(id) ?? "?").join(", ")}
                            </span>
                          </>
                        ) : (
                          "Libera com qualquer curso"
                        )
                      ) : (
                        <span className="opacity-60">/{t.slug} · posição {t.position}</span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => setEditando(editando === t.id ? null : t.id)}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors min-h-[40px]"
                  >
                    {editando === t.id ? <X className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                    {editando === t.id ? "Fechar" : "Editar"}
                  </button>
                </div>

                {editando === t.id && (
                  <ToolForm tool={t} categorias={categorias} onDone={() => setEditando(null)} />
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ToolForm({
  tool,
  categorias,
  onDone,
}: {
  tool: ToolAdminRow;
  categorias: CategoriaOpcao[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<ToolActionState, FormData>(updateToolAction, {});
  const [tier, setTier] = useState(tool.min_tier);
  const campo =
    "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40";

  return (
    <form action={action} className="mt-4 rounded-lg bg-muted/40 p-4 space-y-4">
      <input type="hidden" name="id" value={tool.id} />

      <div className="grid sm:grid-cols-[1fr_80px] gap-3">
        <label className="block text-xs font-medium text-muted-foreground">
          Nome
          <input name="name" defaultValue={tool.name} required className={campo} />
        </label>
        <label className="block text-xs font-medium text-muted-foreground">
          Ícone
          <input name="icon" defaultValue={tool.icon ?? ""} maxLength={8} className={campo} />
        </label>
      </div>

      <label className="block text-xs font-medium text-muted-foreground">
        Descrição
        <input name="description" defaultValue={tool.description ?? ""} maxLength={200} className={campo} />
      </label>

      <div className="grid sm:grid-cols-3 gap-3">
        <label className="block text-xs font-medium text-muted-foreground">
          Grupo
          <select name="section" defaultValue={tool.section} className={campo}>
            <option value="calcular">Calcular</option>
            <option value="guardar">Guardar</option>
            <option value="fornecedores">Fornecedores</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-muted-foreground">
          Quem abre
          <select
            name="min_tier"
            value={tier}
            onChange={(e) => setTier(e.target.value as ToolAdminRow["min_tier"])}
            className={campo}
          >
            <option value="visitante">Todas as contas</option>
            <option value="aluna">Alunas — por categoria de curso</option>
            <option value="completo">Só Handify Completo</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-muted-foreground">
          Posição
          <input name="position" type="number" min={0} max={999} defaultValue={tool.position} className={campo} />
        </label>
      </div>

      {tier === "aluna" && (
        <fieldset className="rounded-lg border border-border bg-background p-3">
          <legend className="px-1 text-xs font-medium text-muted-foreground">
            Categorias de curso que liberam
          </legend>
          <p className="text-xs text-muted-foreground mb-2">
            Sem nenhuma marcada, qualquer curso libera. O Handify Completo sempre abre.
          </p>
          <div className="grid sm:grid-cols-2 gap-1.5">
            {categorias.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm min-h-[36px]">
                <input
                  type="checkbox"
                  name="category_ids"
                  value={c.id}
                  defaultChecked={tool.category_ids.includes(c.id)}
                  className="w-4 h-4 accent-[#6699F3]"
                />
                {c.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <label className="block text-xs font-medium text-muted-foreground">
        Rota{" "}
        <span className="font-normal">
          — pode usar <code>{"{nicho}"}</code> (slug do artesanato dela) e <code>{"{nicho_id}"}</code>
        </span>
        <input name="href" defaultValue={tool.href ?? ""} placeholder="/ferramentas/…" className={campo} />
      </label>

      <div className="flex flex-wrap gap-5">
        <label className="flex items-center gap-2 text-sm min-h-[36px]">
          <input type="checkbox" name="coming_soon" defaultChecked={tool.coming_soon} className="w-4 h-4 accent-[#6699F3]" />
          Em breve (aparece, mas não abre)
        </label>
        <label className="flex items-center gap-2 text-sm min-h-[36px]">
          <input type="checkbox" name="active" defaultChecked={tool.active} className="w-4 h-4 accent-[#6699F3]" />
          Ativa (desmarcada some da lista)
        </label>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-[#3d9e5a]">{state.success}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#6699F3] text-white hover:bg-[#5580d4] disabled:opacity-60 transition-colors min-h-[40px]"
        >
          {pending ? "Salvando…" : "Salvar"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground min-h-[40px]"
        >
          Fechar
        </button>
      </div>
    </form>
  );
}
