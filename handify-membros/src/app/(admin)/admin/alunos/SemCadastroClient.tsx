"use client";

import { useState, useTransition, useMemo } from "react";
import {
  Mail,
  Phone,
  Package,
  Clock,
  RefreshCw,
  X,
  Search,
  AlertCircle,
} from "lucide-react";
import { resendActivationAction } from "./resend-actions";
import { useModalBackGuard } from "@/hooks/useModalBackGuard";

export type PendingCourse = {
  id: string | null;
  title: string | null;
  slug: string | null;
  token: string;
  expires_at: string;
};

export type SemCadastroRow = {
  email: string;
  buyer_name: string | null;
  buyer_phone: string | null;
  created_at: string;
  courses: PendingCourse[];
};

export default function SemCadastroClient({
  rows,
}: {
  rows: SemCadastroRow[];
}) {
  const [selected, setSelected] = useState<SemCadastroRow | null>(null);
  const [search, setSearch] = useState("");
  useModalBackGuard(!!selected, () => setSelected(null));

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.email.toLowerCase().includes(q) ||
        r.buyer_name?.toLowerCase().includes(q)
    );
  }, [rows, search]);

  return (
    <>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          placeholder="Buscar por nome ou e-mail…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30"
        />
      </div>

      <div className="handify-card overflow-hidden overflow-x-auto">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">
              {rows.length === 0
                ? "Todas as compradoras já criaram sua conta."
                : "Nenhuma encontrada com este termo."}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-foreground/70">
                  Nome / E-mail
                </th>
                <th className="text-left px-4 py-3 font-semibold text-foreground/70 hidden md:table-cell">
                  Telefone
                </th>
                <th className="text-left px-4 py-3 font-semibold text-foreground/70 hidden sm:table-cell">
                  Cursos
                </th>
                <th className="text-left px-4 py-3 font-semibold text-foreground/70 hidden lg:table-cell">
                  Compra
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.map((row) => (
                <TableRow
                  key={row.email}
                  row={row}
                  onSelect={setSelected}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <DetailModal row={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

// ── Linha da tabela ───────────────────────────────────────────────────────────

function TableRow({
  row,
  onSelect,
}: {
  row: SemCadastroRow;
  onSelect: (r: SemCadastroRow) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const now = new Date();
  const allExpired = row.courses.every((c) => new Date(c.expires_at) < now);

  function handleResend(e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(async () => {
      setSent(null);
      setErr(null);
      const res = await resendActivationAction(row.email);
      if (res.error) setErr(res.error);
      else setSent(res.sent ?? 0);
    });
  }

  return (
    <tr
      className="hover:bg-muted/20 transition-colors cursor-pointer"
      onClick={() => onSelect(row)}
    >
      {/* Nome + e-mail */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: "#FEC649", color: "#2D2D2D" }}
          >
            {(row.buyer_name ?? row.email).charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-medium truncate max-w-[150px]">
                {row.buyer_name ?? (
                  <span className="text-muted-foreground/50 italic text-xs">
                    Sem nome
                  </span>
                )}
              </p>
              {allExpired && (
                <span title="Link de ativação expirado">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate max-w-[150px]">
              {row.email}
            </p>
          </div>
        </div>
      </td>

      {/* Telefone */}
      <td className="px-4 py-3 hidden md:table-cell">
        {row.buyer_phone ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Phone className="w-3.5 h-3.5 shrink-0" />
            {row.buyer_phone}
          </span>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </td>

      {/* Cursos */}
      <td className="px-4 py-3 hidden sm:table-cell">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#6699F3]">
          <Package className="w-3.5 h-3.5" />
          {row.courses.length} curso{row.courses.length !== 1 ? "s" : ""}
        </span>
      </td>

      {/* Data */}
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className="text-xs text-muted-foreground">
          {new Date(row.created_at).toLocaleDateString("pt-BR")}
        </span>
      </td>

      {/* Ações */}
      <td
        className="px-4 py-3 text-right"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-end gap-2">
          {sent !== null && (
            <span className="text-xs text-[#72CF92] font-medium whitespace-nowrap">
              {sent > 0
                ? `${sent} enviado${sent !== 1 ? "s" : ""} ✓`
                : "Sem cursos válidos"}
            </span>
          )}
          {err && (
            <span className="text-xs text-red-500 max-w-[120px] truncate" title={err}>
              {err}
            </span>
          )}
          <button
            onClick={handleResend}
            disabled={pending}
            title="Reenviar e-mail de ativação"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-[#6699F3]/30 text-[#6699F3] hover:bg-[#6699F3]/10 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${pending ? "animate-spin" : ""}`}
            />
            {pending ? "Enviando…" : "Reenviar"}
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Modal de detalhe ──────────────────────────────────────────────────────────

function DetailModal({
  row,
  onClose,
}: {
  row: SemCadastroRow;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function handleResend() {
    startTransition(async () => {
      setSent(null);
      setErr(null);
      const res = await resendActivationAction(row.email);
      if (res.error) setErr(res.error);
      else setSent(res.sent ?? 0);
    });
  }

  const now = new Date();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="handify-card w-full max-w-md flex flex-col overflow-hidden"
        style={{ maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-border">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
            style={{ background: "#FEC649", color: "#2D2D2D" }}
          >
            {(row.buyer_name ?? row.email).charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">
              {row.buyer_name ?? "Sem nome"}
            </p>
            <p className="text-xs text-muted-foreground truncate">{row.email}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors shrink-0"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Dados */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                <Mail className="w-3.5 h-3.5" /> E-mail
              </p>
              <p className="text-sm font-medium break-all">{row.email}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                <Phone className="w-3.5 h-3.5" /> WhatsApp
              </p>
              <p className="text-sm font-medium">{row.buyer_phone ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                <Clock className="w-3.5 h-3.5" /> Data da compra
              </p>
              <p className="text-sm font-medium">
                {new Date(row.created_at).toLocaleDateString("pt-BR")}
              </p>
            </div>
          </div>

          {/* Cursos pendentes */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Cursos aguardando ativação
            </p>
            <div className="space-y-2">
              {row.courses.map((c) => {
                const expired = new Date(c.expires_at) < now;
                return (
                  <div
                    key={c.token}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border/50"
                  >
                    <Package className="w-4 h-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {c.title ?? "Curso"}
                      </p>
                      <p
                        className={`text-[11px] mt-0.5 ${expired ? "text-amber-500" : "text-muted-foreground"}`}
                      >
                        Link {expired ? "expirou" : "expira"}{" "}
                        {new Date(c.expires_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    {expired && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">
                        Expirado
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Feedback */}
          {sent !== null && (
            <div className="rounded-lg bg-[#72CF92]/10 border border-[#72CF92]/30 px-4 py-3 text-sm text-[#3d9e5a]">
              {sent > 0
                ? `${sent} e-mail${sent !== 1 ? "s" : ""} de ativação enviado${sent !== 1 ? "s" : ""} com sucesso.`
                : "Nenhum e-mail enviado — sem cursos com token válido."}
            </div>
          )}
          {err && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              {err}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border space-y-2">
          <button
            onClick={handleResend}
            disabled={pending}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-[#6699F3] text-white hover:bg-[#5580d4] transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${pending ? "animate-spin" : ""}`}
            />
            {pending ? "Enviando e-mails…" : "Reenviar e-mail de ativação"}
          </button>
          <p className="text-center text-xs text-muted-foreground">
            Um e-mail por curso · Links expirados são renovados automaticamente
          </p>
        </div>
      </div>
    </div>
  );
}
