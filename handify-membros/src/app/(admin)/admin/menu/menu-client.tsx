"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, BookOpen, User, Bell, Users, Home,
  ShoppingBag, Star, Heart, Globe, MessageSquare, Video,
  Award, Settings, HelpCircle, GraduationCap, Layers,
  Zap, Gift, Map, Pencil, Trash2, Plus, ExternalLink,
  Eye, EyeOff, X, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createMenuItemAction,
  updateMenuItemAction,
  deleteMenuItemAction,
  toggleMenuItemActiveAction,
} from "./actions";
import { VALID_ICONS as ICON_OPTIONS } from "./constants";

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, BookOpen, User, Bell, Users, Home,
  ShoppingBag, Star, Heart, Globe, MessageSquare, Video,
  Award, Settings, HelpCircle, GraduationCap, Layers,
  Zap, Gift, Map,
};

type MenuItem = {
  id: string;
  label: string;
  url: string;
  icon: string | null;
  target: "_self" | "_blank";
  visible_to: "guest" | "student" | "admin";
  position: number;
  parent_id: string | null;
  active: boolean;
};

const VISIBILITY_LABELS: Record<string, string> = {
  guest: "Todos (visitantes + alunas)",
  student: "Apenas alunas logadas",
  admin: "Apenas admins",
};

const SELECT_CLASS =
  "w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";

function ItemForm({
  item,
  parentOptions,
  onClose,
}: {
  item?: MenuItem;
  parentOptions: MenuItem[];
  onClose: () => void;
}) {
  const isEdit = !!item;
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const action = isEdit ? updateMenuItemAction : createMenuItemAction;
      const result = await action({}, formData);
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
        onClose();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isEdit && <input type="hidden" name="id" value={item.id} />}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="label">Label</Label>
          <Input
            id="label"
            name="label"
            defaultValue={item?.label}
            placeholder="Minha Jornada"
            required
            maxLength={60}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="url">URL</Label>
          <Input
            id="url"
            name="url"
            defaultValue={item?.url}
            placeholder="/dashboard"
            required
            maxLength={255}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="icon">Ícone</Label>
          <select id="icon" name="icon" defaultValue={item?.icon ?? ""} className={SELECT_CLASS}>
            <option value="">Sem ícone</option>
            {ICON_OPTIONS.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="position">Posição</Label>
          <Input
            id="position"
            name="position"
            type="number"
            defaultValue={item?.position ?? 0}
            min={0}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="visible_to">Visibilidade</Label>
          <select id="visible_to" name="visible_to" defaultValue={item?.visible_to ?? "student"} className={SELECT_CLASS}>
            {Object.entries(VISIBILITY_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="target">Abrir em</Label>
          <select id="target" name="target" defaultValue={item?.target ?? "_self"} className={SELECT_CLASS}>
            <option value="_self">Mesma aba</option>
            <option value="_blank">Nova aba</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="parent_id">Item pai (sub-menu)</Label>
          <select id="parent_id" name="parent_id" defaultValue={item?.parent_id ?? ""} className={SELECT_CLASS}>
            <option value="">Nenhum (nível raiz)</option>
            {parentOptions
              .filter((p) => p.id !== item?.id)
              .map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
          </select>
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="active"
              value="true"
              defaultChecked={item?.active ?? true}
              className="w-4 h-4 accent-[#6699F3]"
            />
            <span className="text-sm font-medium">Ativo</span>
          </label>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isPending}
          style={{ background: "#6699F3" }}
          className="text-white"
        >
          {isPending ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar item"}
        </Button>
      </div>
    </form>
  );
}

function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
          <h2 className="font-semibold text-base">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

export default function MenuClient({ items }: { items: MenuItem[] }) {
  const router = useRouter();
  const [dialogItem, setDialogItem] = useState<MenuItem | null | "new">(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleClose = useCallback(() => setDialogItem(null), []);

  const roots = items.filter((i) => !i.parent_id).sort((a, b) => a.position - b.position);
  const childrenOf = (parentId: string) =>
    items.filter((i) => i.parent_id === parentId).sort((a, b) => a.position - b.position);

  async function handleDelete(id: string) {
    if (!confirm("Excluir este item de menu?")) return;
    setDeletingId(id);
    await deleteMenuItemAction(id);
    setDeletingId(null);
    router.refresh();
  }

  async function handleToggle(id: string, active: boolean) {
    setTogglingId(id);
    await toggleMenuItemActiveAction(id, !active);
    setTogglingId(null);
    router.refresh();
  }

  function renderRow(item: MenuItem, isChild = false) {
    const Icon = item.icon ? ICON_MAP[item.icon] : null;
    const busy = deletingId === item.id || togglingId === item.id;
    const visibilityColor =
      item.visible_to === "admin"
        ? { color: "#FEC649", border: "#FEC649", bg: "#FEC64918" }
        : item.visible_to === "guest"
        ? { color: "#6699F3", border: "#6699F3", bg: "#6699F318" }
        : { color: "#72CF92", border: "#72CF92", bg: "#72CF9218" };

    return (
      <div
        key={item.id}
        className={`flex items-center gap-3 px-4 py-3 border-b border-border/30 last:border-0 ${
          isChild ? "pl-10 bg-[#F5F5F0]" : "bg-white"
        } ${!item.active ? "opacity-50" : ""}`}
      >
        <div className="text-muted-foreground w-4 shrink-0">
          {Icon ? <Icon className="w-4 h-4" /> : null}
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-medium text-sm truncate block">{item.label}</span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            {item.url}
            {item.target === "_blank" && <ExternalLink className="w-3 h-3" />}
          </span>
        </div>
        <span
          className="hidden sm:inline-flex text-xs px-2 py-0.5 rounded-full border font-medium shrink-0"
          style={{ color: visibilityColor.color, borderColor: visibilityColor.border, background: visibilityColor.bg }}
        >
          {item.visible_to}
        </span>
        <span className="text-xs text-muted-foreground w-5 text-right shrink-0">{item.position}</span>
        <div className="flex items-center gap-1 ml-1 shrink-0">
          <button
            onClick={() => handleToggle(item.id, item.active)}
            disabled={busy}
            aria-label={item.active ? "Desativar" : "Ativar"}
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            {item.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setDialogItem(item)}
            aria-label="Editar"
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(item.id)}
            disabled={busy}
            aria-label="Excluir"
            className="p-1.5 rounded hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600 disabled:opacity-40"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Menu de Navegação</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie os itens de menu exibidos para alunas e visitantes.
          </p>
        </div>
        <Button
          onClick={() => setDialogItem("new")}
          style={{ background: "#6699F3" }}
          className="text-white"
        >
          <Plus className="w-4 h-4 mr-1" /> Novo item
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-white rounded-xl border border-border/60">
          <p className="text-sm">Nenhum item de menu cadastrado.</p>
          <p className="text-xs mt-1">Execute a migração SQL no Supabase para adicionar os itens padrão.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 overflow-hidden shadow-sm">
          <div className="px-4 py-2.5 bg-[#F5F5F0] border-b border-border/40 flex gap-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span className="w-4" />
            <span className="flex-1">Label / URL</span>
            <span className="hidden sm:block w-32">Visível para</span>
            <span className="w-5 text-right">Pos</span>
            <span className="w-24" />
          </div>
          {roots.map((item) => (
            <div key={item.id}>
              {renderRow(item)}
              {childrenOf(item.id).map((child) => renderRow(child, true))}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={dialogItem !== null}
        title={dialogItem === "new" ? "Novo item de menu" : "Editar item de menu"}
        onClose={handleClose}
      >
        {dialogItem !== null && (
          <ItemForm
            item={dialogItem === "new" ? undefined : dialogItem}
            parentOptions={items.filter((i) => !i.parent_id)}
            onClose={handleClose}
          />
        )}
      </Modal>
    </>
  );
}
