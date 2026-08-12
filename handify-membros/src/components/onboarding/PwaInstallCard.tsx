"use client";

import { useState, useEffect } from "react";
import { Smartphone, X, ChevronDown, ChevronUp } from "lucide-react";

const STORAGE_KEY = "handify_pwa_install_dismissed";

export default function PwaInstallCard() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Já está instalada como PWA — não mostrar
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator &&
        (window.navigator as { standalone?: boolean }).standalone === true);

    if (isStandalone) return;

    // Usuária já dispensou
    if (localStorage.getItem(STORAGE_KEY)) return;

    setVisible(true);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="handify-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-[#6699F3] shrink-0 mt-0.5" />
          <h2 className="text-sm font-semibold text-foreground">
            Baixe o app da Handify no seu celular
          </h2>
        </div>
        <button
          onClick={dismiss}
          aria-label="Fechar"
          className="shrink-0 rounded-lg p-1 text-foreground/40 hover:text-foreground hover:bg-black/5 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Acesse a plataforma direto pela tela inicial do seu celular, sem precisar abrir o navegador.
      </p>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="mt-3 flex items-center gap-1 text-sm font-medium text-[#6699F3] hover:underline"
      >
        {expanded ? "Esconder instruções" : "Ver como instalar"}
        {expanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {expanded && (
        <div className="mt-4 grid sm:grid-cols-2 gap-4">
          {/* Android */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Android (Chrome)
            </p>
            <ol className="space-y-1.5">
              {[
                "Abra esta página no navegador Chrome",
                "Toque nos três pontos no canto superior direito",
                'Selecione "Adicionar à tela inicial"',
                'Confirme tocando em "Adicionar"',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#6699F3]/15 text-[10px] font-bold text-[#6699F3]">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* iPhone */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
              iPhone (Safari)
            </p>
            <ol className="space-y-1.5">
              {[
                "Abra esta página no navegador Safari",
                "Toque no ícone de compartilhar (quadrado com seta)",
                'Role e selecione "Adicionar à Tela de Início"',
                'Toque em "Adicionar" no canto superior direito',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#6699F3]/15 text-[10px] font-bold text-[#6699F3]">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          onClick={dismiss}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors min-h-[36px] px-2"
        >
          Já instalei
        </button>
      </div>
    </div>
  );
}
