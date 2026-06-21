"use client";

import { useEffect, useState } from "react";
import { Download, X, Smartphone } from "lucide-react";

type Platform = "android" | "ios" | null;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "pwa-install-dismissed";

function isRunningAsPWA() {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator as any).standalone === true
  );
}

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  return null;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<Platform>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Já instalado ou já dispensou nesta sessão
    if (isRunningAsPWA()) return;
    if (sessionStorage.getItem(DISMISSED_KEY)) return;

    const detected = detectPlatform();
    setPlatform(detected);

    // Android/Chrome: aguarda o evento nativo
    function handleBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // iOS Safari: não tem beforeinstallprompt — mostra instruções manuais
    if (detected === "ios") {
      setVisible(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  function dismiss() {
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setVisible(false);
    setDeferredPrompt(null);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Instalar aplicativo"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-border/60 overflow-hidden">
        {/* Faixa tricolor */}
        <div className="brand-stripe"><span /><span /><span /></div>

        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#6699F3]/10 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5 text-[#6699F3]" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">Instale o app Handify™</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Acesse seus cursos direto da tela inicial, sem abrir o navegador.
              </p>
            </div>

            <button
              onClick={dismiss}
              aria-label="Fechar"
              className="p-1 text-muted-foreground hover:text-foreground transition-colors shrink-0 -mt-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Android / Chrome: botão nativo */}
          {platform !== "ios" && deferredPrompt && (
            <button
              onClick={handleInstall}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#6699F3] text-white text-sm font-bold hover:opacity-90 active:scale-95 transition-all"
            >
              <Download className="w-4 h-4" />
              Instalar aplicativo
            </button>
          )}

          {/* iOS Safari: instruções manuais */}
          {platform === "ios" && (
            <div className="mt-3 bg-[#F5F5F0] rounded-xl px-3 py-2.5 space-y-1.5">
              <p className="text-xs font-semibold text-foreground/80">Como instalar no iPhone / iPad:</p>
              <ol className="text-xs text-muted-foreground space-y-1">
                <li className="flex items-start gap-1.5">
                  <span className="font-bold text-[#6699F3] shrink-0">1.</span>
                  Toque no botão <strong>Compartilhar</strong> <span className="inline-block">⬆</span> na barra do Safari
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="font-bold text-[#6699F3] shrink-0">2.</span>
                  Role e toque em <strong>"Adicionar à Tela de Início"</strong>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="font-bold text-[#6699F3] shrink-0">3.</span>
                  Toque em <strong>Adicionar</strong> no canto superior direito
                </li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
