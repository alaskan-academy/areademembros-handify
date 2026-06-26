"use client";

import { useEffect, useState } from "react";
import { useModalBackGuard } from "@/hooks/useModalBackGuard";
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
  useModalBackGuard(visible, () => setVisible(false));

  useEffect(() => {
    if (isRunningAsPWA()) return;
    if (sessionStorage.getItem(DISMISSED_KEY)) return;

    const detected = detectPlatform();
    setPlatform(detected);

    function handleBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={dismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Instalar aplicativo"
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-border/60 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Faixa tricolor */}
        <div className="brand-stripe"><span /><span /><span /></div>

        <div className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#6699F3]/10 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5 text-[#6699F3]" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-foreground">Instale o app Handify™</p>
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

          {/* Android / Chrome */}
          {platform !== "ios" && deferredPrompt && (
            <div className="flex gap-2">
              <button
                onClick={handleInstall}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#6699F3] text-white text-sm font-bold hover:opacity-90 active:scale-95 transition-all"
              >
                <Download className="w-4 h-4" />
                Instalar aplicativo
              </button>
              <button
                onClick={dismiss}
                className="px-4 py-2.5 rounded-xl border border-border text-muted-foreground text-sm hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                Depois
              </button>
            </div>
          )}

          {/* iOS Safari */}
          {platform === "ios" && (
            <>
              <div className="bg-[#F5F5F0] rounded-xl px-3 py-3 space-y-2 mb-3">
                <p className="text-xs font-semibold text-foreground/80">Como instalar no iPhone / iPad:</p>
                <ol className="text-xs text-muted-foreground space-y-1.5">
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
              <button
                onClick={dismiss}
                className="w-full py-2.5 rounded-xl border border-border text-muted-foreground text-sm hover:text-foreground transition-colors"
              >
                Entendido
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
