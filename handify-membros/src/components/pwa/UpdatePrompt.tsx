"use client";

import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";

const LS_KEY = "sw-update-dismissed-url";

export default function UpdatePrompt() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Recém-recarregado após update — ignora
    if (sessionStorage.getItem("sw-updating")) {
      sessionStorage.removeItem("sw-updating");
      return;
    }

    function checkForWaiting(reg: ServiceWorkerRegistration) {
      if (reg.waiting && navigator.serviceWorker.controller) {
        // Só mostra se a aluna ainda não dispensou esse SW específico
        const dismissedUrl = localStorage.getItem(LS_KEY);
        if (dismissedUrl !== reg.waiting.scriptURL) {
          setWaitingWorker(reg.waiting);
        }
      }
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            const dismissedUrl = localStorage.getItem(LS_KEY);
            if (dismissedUrl !== newWorker.scriptURL) {
              setWaitingWorker(newWorker);
            }
          }
        });
      });
    }

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) checkForWaiting(reg);
    });

    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      // SW atualizou de fato — limpa o dismiss salvo
      localStorage.removeItem(LS_KEY);
      if (!reloading) { reloading = true; window.location.reload(); }
    });
  }, []);

  function handleUpdate() {
    sessionStorage.setItem("sw-updating", "1");
    setDismissed(true);
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }
    setTimeout(() => window.location.reload(), 400);
  }

  function handleDismiss() {
    // Persiste o dismiss para esse SW específico — não volta a aparecer em refreshes
    if (waitingWorker) {
      localStorage.setItem(LS_KEY, waitingWorker.scriptURL);
    }
    setDismissed(true);
  }

  if (!waitingWorker || dismissed) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={handleDismiss}
    >
      <div
        role="alert"
        className="w-full max-w-sm bg-[#0F0F0F] text-white rounded-2xl shadow-2xl border border-white/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Faixa tricolor */}
        <div className="brand-stripe"><span /><span /><span /></div>

        <div className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#6699F3]/20 flex items-center justify-center shrink-0">
              <RefreshCw className="w-5 h-5 text-[#6699F3]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">Nova versão disponível</p>
              <p className="text-xs text-white/50 mt-0.5 leading-relaxed">
                Atualize para ter as últimas melhorias da plataforma.
              </p>
            </div>
            <button
              onClick={handleDismiss}
              aria-label="Dispensar"
              className="p-1 text-white/30 hover:text-white transition-colors shrink-0 -mt-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleUpdate}
              className="flex-1 py-2.5 rounded-xl bg-[#6699F3] text-white text-sm font-bold hover:opacity-90 active:scale-95 transition-all"
            >
              Atualizar agora
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2.5 rounded-xl border border-white/15 text-white/60 text-sm hover:text-white hover:border-white/30 transition-colors"
            >
              Depois
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
