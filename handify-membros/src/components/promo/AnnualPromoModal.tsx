"use client";

import { useEffect, useRef } from "react";
import { useModalBackGuard } from "@/hooks/useModalBackGuard";
import { X, Star, CheckCircle2, ArrowRight } from "lucide-react";

export interface AnnualPromoData {
  badge_text: string;
  modal_title: string;
  modal_desc: string;
  button_text: string;
  link_url: string;
}

interface Props {
  promo: AnnualPromoData;
  onClose: () => void;
}

export default function AnnualPromoModal({ promo, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  useModalBackGuard(true, onClose);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  // Renderiza o texto da descrição respeitando quebras de linha
  const descParagraphs = promo.modal_desc
    ? promo.modal_desc.split("\n").filter(Boolean)
    : [];

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={promo.modal_title}
    >
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">

        {/* Faixa tricolor */}
        <div className="brand-stripe flex-shrink-0"><span /><span /><span /></div>

        {/* Fechar */}
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 p-1.5 rounded-full text-foreground/40 hover:text-foreground hover:bg-muted transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Hero section */}
        <div className="flex-shrink-0 bg-gradient-to-br from-[#6699F3]/10 via-white to-[#72CF92]/10 px-6 pt-8 pb-6 text-center">
          <div className="inline-flex items-center gap-1.5 bg-[#FEC649]/20 text-[#FEC649] text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wider">
            <Star className="w-3.5 h-3.5 fill-current" />
            {promo.badge_text}
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-foreground leading-tight mb-2">
            {promo.modal_title}
          </h2>
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {descParagraphs.length > 0 ? (
            <div className="space-y-3">
              {descParagraphs.map((line, i) => {
                // Linhas que começam com "✓" ou "-" viram bullet points
                if (line.startsWith("✓") || line.startsWith("- ") || line.startsWith("• ")) {
                  const text = line.replace(/^[✓\-•]\s*/, "");
                  return (
                    <div key={i} className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#72CF92] shrink-0 mt-0.5" />
                      <p className="text-sm text-foreground/80">{text}</p>
                    </div>
                  );
                }
                return (
                  <p key={i} className="text-sm text-foreground/80 leading-relaxed">{line}</p>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Acesso completo a todos os cursos da plataforma.
            </p>
          )}
        </div>

        {/* CTA fixo */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-border/40 bg-white">
          <a
            href={promo.link_url || "#"}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-[#6699F3] text-white font-bold text-sm hover:opacity-90 active:scale-95 transition-all"
          >
            {promo.button_text || "Assinar agora"}
            <ArrowRight className="w-4 h-4" />
          </a>
          <button
            onClick={onClose}
            className="mt-2 w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1.5"
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}
