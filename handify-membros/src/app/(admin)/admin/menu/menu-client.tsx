"use client";

import { useState, useActionState, useEffect } from "react";
import {
  LayoutDashboard, BookOpen, User, Bell, Users, Home,
  ShoppingBag, Star, Heart, Globe, MessageSquare, Video,
  Award, Settings, HelpCircle, GraduationCap, Layers,
  Zap, Gift, Map, Pencil, Trash2, Plus, ExternalLink,
  Eye, EyeOff, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  createMenuItemAction,
  updateMenuItemAction,
  deleteMenuItemAction,
  toggleMenuItemActiveAction,
  ICON_OPTIONS,
  type MenuItemFormState,
} from "./actions";

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

const VISIBILITY_LABELS = {
  guest: "Todos (visitantes + alunas)",
  student: "Apenas alunas logadas",
  admin: "Apenas admins",
};

const INITIAL_STATE: MenuItemFormState = {};

function MenuIcon({ name }: { name: string | null }) {
  if (!name) return null;
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  return <Icon className="w-4 h-4" />;
}

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
  const action = isEdit ? updateMenuItemAction : createMenuItemAction;
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  const [selectedIcon, setSelectedIcon] = useState<string>(item?.icon ?? "");
  const [visibleTo, setVisibleTo] = useState<string>(item?.visible_to ?? "student");
  const [target, setTarget] = useState<string>(item?.target ?? "_self");
  const [parentId, setParentId] = useState<string>(item?.parent_id ?? "");
  const [active, setActive] = useState<boolean>(item?.active ?? true);

  return (
    <form action={formAction} className="space-y-4">
      {isEdit && <input type="hidden" name="id" value={item.id} />}
      <input type="hidden" name="icon" value={selectedIcon} />
      <input type="hidden" name="visible_to" value={visibleTo} />
      <input type="hidden" name="target" value={target} />
      <input type="hidden" name="parent_id" value={parentId} />
      <input type="hidden" name="active" value={String(active)} />

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
          <Label>Ícone</Label>
          <Select value={selectedIcon} onValueChange={setSelectedIcon}>
            <SelectTrigger>
              <SelectValue placeholder="Sem ícone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Sem ícone</SelectItem>
              {ICON_OPTIONS.map((name) => {
                const Icon = ICON_MAP[name];
                return (
                  <SelectItem key={name} value={name}>
                    <span className="flex items-center gap-2">
                      {Icon && <Icon className="w-4 h-4" />} {name}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
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
          <Label>Visibilidade</Label>
          <Select value={visibleTo} onValueChange={setVisibleTo}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(VISIBILITY_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Abrir em</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_self">Mesma aba</SelectItem>
              <SelectItem value="_blank">Nova aba</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Item pai (sub-menu)</Label>
          <Select value={parentId} onValueChange={setParentId}>
            <SelectTrigger>
              <SelectValue placeholder="Nenhum (nível raiz)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Nenhum (nível raiz)</SelectItem>
              {parentOptions
                .filter((p) => p.id !== item?.id)
                .map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end pb-0.5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 accent-[#6699F3]"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            <span className="text-sm font-medium">Ativo</span>
          </label>
        </div>
      </div>

      {state.error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{state.error}</p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={pending}
          style={{ background: "#6699F3" }}
          className="text-white"
        >
          {pending ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar item"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function MenuClient({ items }: { items: MenuItem[] }) {
  const [dialogItem, setDialogItem] = useState<MenuItem | null | "new">(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const roots = items.filter((i) => !i.parent_id).sort((a, b) => a.position - b.position);
  const children = (parentId: string) =>
    items.filter((i) => i.parent_id === parentId).sort((a, b) => a.position - b.position);

  async function handleDelete(id: string) {
    setDeletingId(id);
    await deleteMenuItemAction(id);
    setDeletingId(null);
  }

  async function handleToggle(id: string, active: boolean) {
    setTogglingId(id);
    await toggleMenuItemActiveAction(id, !active);
    setTogglingId(null);
  }

  function renderRow(item: MenuItem, isChild = false) {
    const Icon = item.icon ? ICON_MAP[item.icon] : null;
    const busy = deletingId === item.id || togglingId === item.id;
    return (
      <div
        key={item.id}
        className={`flex items-center gap-3 px-4 py-3 border-b border-border/30 last:border-0 bg-white ${isChild ? "pl-10 bg-[#F5F5F0]" : ""} ${!item.active ? "opacity-50" : ""}`}
      >
        <div className="text-muted-foreground">
          {Icon ? <Icon className="w-4 h-4" /> : <span className="w-4 h-4 block" />}
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-medium text-sm truncate block">{item.label}</span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            {item.url}
            {item.target === "_blank" && <ExternalLink className="w-3 h-3" />}
          </span>
        </div>
        <span className="hidden sm:inline-flex text-xs px-2 py-0.5 rounded-full border font-medium"
          style={{
            color: item.visible_to === "admin" ? "#FEC649" : item.visible_to === "guest" ? "#6699F3" : "#72CF92",
            borderColor: item.visible_to === "admin" ? "#FEC649" : item.visible_to === "guest" ? "#6699F3" : "#72CF92",
            background: item.visible_to === "admin" ? "#FEC64915" : item.visible_to === "guest" ? "#6699F315" : "#72CF9215",
          }}
        >
          {item.visible_to}
        </span>
        <span className="text-xs text-muted-foreground w-6 text-right">{item.position}</span>
        <div className="flex items-center gap-1 ml-1">
          <button
            onClick={() => handleToggle(item.id, item.active)}
            disabled={busy}
            aria-label={item.active ? "Desativar" : "Ativar"}
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
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
            className="p-1.5 rounded hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600"
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
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-sm">Nenhum item de menu cadastrado.</p>
          <p className="text-xs mt-1">Execute a migração SQL para adicionar os itens padrão.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 overflow-hidden shadow-sm">
          <div className="px-4 py-2.5 bg-[#F5F5F0] border-b border-border/40 grid grid-cols-[1.5rem_1fr_auto_auto_auto] gap-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span />
            <span>Label / URL</span>
            <span className="hidden sm:block">Visível para</span>
            <span className="w-6 text-right">Pos</span>
            <span className="w-20" />
          </div>
          {roots.map((item) => (
            <div key={item.id}>
              {renderRow(item)}
              {children(item.id).map((child) => renderRow(child, true))}
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogItem !== null} onOpenChange={(o) => !o && setDialogItem(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogItem === "new" ? "Novo item de menu" : "Editar item de menu"}
            </DialogTitle>
          </DialogHeader>
          {dialogItem !== null && (
            <ItemForm
              item={dialogItem === "new" ? undefined : dialogItem}
              parentOptions={items.filter((i) => !i.parent_id)}
              onClose={() => setDialogItem(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
