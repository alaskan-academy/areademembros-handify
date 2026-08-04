"use client";

import { useEffect, useState } from "react";
import { Download, Share, X, CheckCircle, Smartphone } from "lucide-react";

type InstallState =
  | "loading"
  | "installed"
  | "installable"   // Chrome / Android / Edge — beforeinstallprompt disponível
  | "ios-safari"    // Safari no iOS — manual (Add to Home Screen)
  | "ios-other"     // Chrome/Firefox no iOS — precisa abrir no Safari
  | "unsupported";  // navegador sem suporte

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export default function InstallAppButton() {
  const [state, setState] = useState<InstallState>("loading");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosModal, setShowIosModal] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Já está rodando como PWA instalado?
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigator as any).standalone === true;

    if (isStandalone) {
      setState("installed");
      return;
    }

    // iOS: qualquer browser (Safari, Chrome, Firefox)
    const ua = navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/i.test(ua);
    if (isIos) {
      // Só o Safari nativo tem "Adicionar à Tela de Início" funcional
      const isSafari = !/CriOS|FxiOS|OPiOS|mercury/i.test(ua);
      setState(isSafari ? "ios-safari" : "ios-other");
      return;
    }

    // O script no <head> pode ter capturado o evento antes de React montar
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const early = (window as any).__pwaInstallPrompt as BeforeInstallPromptEvent | undefined;
    if (early) {
      setDeferredPrompt(early);
      setState("installable");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__pwaInstallPrompt;
      window.addEventListener("appinstalled", () => setInstalled(true));
      return;
    }

    // Ainda não disparou — continua ouvindo
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setState("installable");
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));

    // Se depois de 3s não chegou o evento, o browser não suporta
    const timeout = setTimeout(() => {
      setState((s) => (s === "loading" ? "unsupported" : s));
    }, 3000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(timeout);
    };
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferredPrompt(null);
  }

  // Oculta se não há nada a oferecer
  if (state === "loading" || state === "unsupported") return null;

  if (state === "installed" || installed) {
    return (
      <div className="flex items-center gap-2.5 text-sm text-[#3d9e5a]">
        <CheckCircle className="w-4 h-4 shrink-0" />
        App instalado neste dispositivo
      </div>
    );
  }

  // Chrome / Firefox no iOS — só o Safari consegue instalar
  if (state === "ios-other") {
    return (
      <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
        <Smartphone className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800 leading-snug">
          Para instalar o app, abra esta página no{" "}
          <strong>Safari</strong> e toque em{" "}
          <Share className="w-3.5 h-3.5 inline -mt-0.5" />{" "}
          → "Adicionar à Tela de Início".
        </p>
      </div>
    );
  }

  if (state === "ios-safari") {
    return (
      <>
        <button
          onClick={() => setShowIosModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-[#6699F3] text-white hover:bg-[#5580d4] transition-colors min-h-[44px]"
        >
          <Share className="w-4 h-4 shrink-0" />
          Adicionar à tela inicial
        </button>

        {showIosModal && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)" }}
            onClick={() => setShowIosModal(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-background border border-border shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Faixa tricolor */}
              <div className="flex h-[3px]">
                <span className="flex-1" style={{ background: "#6699F3" }} />
                <span className="flex-1" style={{ background: "#72CF92" }} />
                <span className="flex-1" style={{ background: "#FEC649" }} />
              </div>

              <div className="p-6 space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[15px]">Instalar no iPhone</p>
                    <p className="text-xs text-muted-foreground mt-0.5">3 passos no Safari</p>
                  </div>
                  <button
                    onClick={() => setShowIosModal(false)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors shrink-0"
                    aria-label="Fechar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <ol className="space-y-4">
                  {[
                    {
                      n: 1,
                      icon: <Share className="w-4 h-4 text-[#6699F3] shrink-0 mt-0.5" />,
                      text: (
                        <>
                          Toque no ícone de{" "}
                          <span className="font-semibold">Compartilhar</span>{" "}
                          <Share className="w-3.5 h-3.5 inline -mt-0.5" /> na barra inferior do Safari
                        </>
                      ),
                    },
                    {
                      n: 2,
                      icon: <Download className="w-4 h-4 text-[#6699F3] shrink-0 mt-0.5" />,
                      text: (
                        <>
                          Role e toque em{" "}
                          <span className="font-semibold">"Adicionar à Tela de Início"</span>
                        </>
                      ),
                    },
                    {
                      n: 3,
                      icon: <CheckCircle className="w-4 h-4 text-[#72CF92] shrink-0 mt-0.5" />,
                      text: (
                        <>
                          Toque em{" "}
                          <span className="font-semibold">"Adicionar"</span>{" "}
                          no canto superior direito
                        </>
                      ),
                    },
                  ].map(({ n, icon, text }) => (
                    <li key={n} className="flex items-start gap-3">
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: "#6699F3", color: "#fff" }}
                      >
                        {n}
                      </span>
                      <div className="flex items-start gap-2 flex-1">
                        {icon}
                        <p className="text-sm text-muted-foreground leading-snug">{text}</p>
                      </div>
                    </li>
                  ))}
                </ol>

                <button
                  onClick={() => setShowIosModal(false)}
                  className="w-full py-2.5 text-sm font-semibold rounded-xl bg-[#6699F3] text-white hover:bg-[#5580d4] transition-colors"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // installable — Chrome / Android / Edge
  return (
    <button
      onClick={handleInstall}
      className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-[#6699F3] text-white hover:bg-[#5580d4] transition-colors min-h-[44px]"
    >
      <Download className="w-4 h-4 shrink-0" />
      Baixar app
    </button>
  );
}
