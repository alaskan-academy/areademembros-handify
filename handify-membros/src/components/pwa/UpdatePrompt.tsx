"use client";

import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";

export default function UpdatePrompt() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    function checkForWaiting(reg: ServiceWorkerRegistration) {
      if (reg.waiting && navigator.serviceWorker.controller) {
        setWaitingWorker(reg.waiting);
      }
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker);
          }
        });
      });
    }

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) checkForWaiting(reg);
    });

    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!reloading) { reloading = true; window.location.reload(); }
    });
  }, []);

  function handleUpdate() {
    setDismissed(true);
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }
    // Fallback: recarrega após 400ms caso controllerchange não dispare
    setTimeout(() => window.location.reload(), 400);
  }

  if (!waitingWorker || dismissed) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={() => setDismissed(true)}
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
              onClick={() => setDismissed(true)}
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
              onClick={() => setDismissed(true)}
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
