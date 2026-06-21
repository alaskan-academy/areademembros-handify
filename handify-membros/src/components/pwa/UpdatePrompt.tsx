"use client";

import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";

export default function UpdatePrompt() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    function checkForWaiting(reg: ServiceWorkerRegistration) {
      // Já tem um SW aguardando (página recarregada com update pendente)
      if (reg.waiting && navigator.serviceWorker.controller) {
        setWaitingWorker(reg.waiting);
      }

      // Novo SW sendo instalado
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

    // Recarrega automaticamente quando o SW novo assumir o controle
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!reloading) { reloading = true; window.location.reload(); }
    });
  }, []);

  function handleUpdate() {
    if (!waitingWorker) return;
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  }

  if (!waitingWorker || dismissed) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm"
    >
      <div className="flex items-center gap-3 bg-[#0F0F0F] text-white px-4 py-3 rounded-xl shadow-2xl border border-white/10">
        <div className="w-8 h-8 rounded-full bg-[#6699F3]/20 flex items-center justify-center shrink-0">
          <RefreshCw className="w-4 h-4 text-[#6699F3]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold">Nova versão disponível</p>
          <p className="text-[11px] text-white/50 mt-0.5">Atualize para ter as últimas melhorias</p>
        </div>
        <button
          onClick={handleUpdate}
          className="shrink-0 px-3 py-1.5 rounded-lg bg-[#6699F3] text-white text-xs font-bold hover:opacity-90 active:scale-95 transition-all"
        >
          Atualizar
        </button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dispensar"
          className="shrink-0 p-1 text-white/40 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
