"use client";

import { useState, useTransition } from "react";
import { Star, ExternalLink, Eye, EyeOff, Check, Loader2 } from "lucide-react";
import { saveAnnualPromo, type AnnualPromo } from "./actions";
import AnnualPromoModal from "@/components/promo/AnnualPromoModal";

interface Props { promo: AnnualPromo }

export default function AnnualPromoClient({ promo: initial }: Props) {
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [, startTransition] = useTransition();

  function set<K extends keyof AnnualPromo>(key: K, value: AnnualPromo[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function handleSave() {
    startTransition(async () => {
      const { id: _, ...data } = form;
      const result = await saveAnnualPromo(data);
      if (result.error) { setError(result.error); return; }
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#FEC649]/15 flex items-center justify-center">
          <Star className="w-5 h-5 text-[#FEC649]" />
        </div>
        <div>
          <h1 className="font-black text-xl">Botão Plano Anual</h1>
          <p className="text-sm text-muted-foreground">Botão no menu que abre modal de vendas do plano anual</p>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      {/* Card de config */}
      <div className="bg-white rounded-xl border border-border/60 shadow-sm divide-y divide-border/40">

        {/* Ativar/desativar */}
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="font-semibold text-sm">Botão ativo</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Quando ativo, aparece no menu para todas as alunas
            </p>
          </div>
          <button
            onClick={() => set("active", !form.active)}
            className={`relative w-11 h-6 rounded-full transition-colors ${form.active ? "bg-[#6699F3]" : "bg-muted-foreground/30"}`}
            aria-label={form.active ? "Desativar" : "Ativar"}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.active ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>

        {/* Texto do badge no menu */}
        <div className="px-5 py-4 space-y-1.5">
          <label className="block text-xs font-medium text-foreground/70">Texto do botão no menu</label>
          <input
            value={form.badge_text}
            onChange={(e) => set("badge_text", e.target.value)}
            placeholder="Ex: Plano Anual, Seja Premium…"
            maxLength={30}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30"
          />
        </div>

        {/* Link de compra */}
        <div className="px-5 py-4 space-y-1.5">
          <label className="block text-xs font-medium text-foreground/70">
            URL de compra <span className="text-muted-foreground">(botão "Assinar" do modal)</span>
          </label>
          <div className="flex gap-2">
            <input
              value={form.link_url}
              onChange={(e) => set("link_url", e.target.value)}
              placeholder="https://checkout.payt.com.br/…"
              type="url"
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30"
            />
            {form.link_url && (
              <a href={form.link_url} target="_blank" rel="noopener noreferrer"
                className="px-3 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>

        {/* Modal: título */}
        <div className="px-5 py-4 space-y-1.5">
          <label className="block text-xs font-medium text-foreground/70">Título do modal</label>
          <input
            value={form.modal_title}
            onChange={(e) => set("modal_title", e.target.value)}
            placeholder="Assine o Plano Anual Handify™"
            maxLength={100}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30"
          />
        </div>

        {/* Modal: descrição */}
        <div className="px-5 py-4 space-y-1.5">
          <label className="block text-xs font-medium text-foreground/70">Descrição do modal</label>
          <textarea
            value={form.modal_desc}
            onChange={(e) => set("modal_desc", e.target.value)}
            placeholder="Descreva os benefícios do plano anual…"
            rows={5}
            maxLength={2000}
            className="w-full resize-none rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30"
          />
          <p className="text-[10px] text-muted-foreground">Suporte a quebras de linha</p>
        </div>

        {/* Modal: texto do botão de compra */}
        <div className="px-5 py-4 space-y-1.5">
          <label className="block text-xs font-medium text-foreground/70">Texto do botão de compra</label>
          <input
            value={form.button_text}
            onChange={(e) => set("button_text", e.target.value)}
            placeholder="Assinar agora"
            maxLength={50}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30"
          />
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#6699F3] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          {saved ? <Check className="w-4 h-4" /> : <Loader2 className="w-4 h-4 opacity-0" />}
          {saved ? "Salvo!" : "Salvar configurações"}
        </button>

        <button
          onClick={() => setPreviewOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Eye className="w-4 h-4" />
          Visualizar modal
        </button>

        {!form.active && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <EyeOff className="w-3.5 h-3.5" /> Botão oculto para as alunas
          </span>
        )}
      </div>

      {previewOpen && (
        <AnnualPromoModal promo={form} onClose={() => setPreviewOpen(false)} />
      )}
    </div>
  );
}
