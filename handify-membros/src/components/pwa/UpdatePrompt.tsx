"use client";

import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";

const LS_DISMISSED = "sw-update-dismissed";
const LS_UPDATED_AT = "sw-updated-at";
const UPDATE_COOLDOWN_MS = 60_000; // 1 minuto após atualizar, sem popup

export default function UpdatePrompt() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Cooldown pós-atualização (1 min)
    const updatedAt = localStorage.getItem(LS_UPDATED_AT);
    if (updatedAt && Date.now() - Number(updatedAt) < UPDATE_COOLDOWN_MS) return;

    // Usuária dispensou o popup nesta sessão
    if (sessionStorage.getItem(LS_DISMISSED)) return;

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
      // SW tomou controle (auto-skipWaiting do Workbox) — recarrega sem limpar estado
      if (!reloading) { reloading = true; window.location.reload(); }
    });
  }, []);

  function handleUpdate() {
    // Salva timestamp para suprimir popup por 1 min após atualizar
    localStorage.setItem(LS_UPDATED_AT, String(Date.now()));
    setDismissed(true);
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }
    setTimeout(() => window.location.reload(), 400);
  }

  function handleDismiss() {
    // Salvo em sessionStorage — persiste em refreshes mas não em reabertura do app
    sessionStorage.setItem(LS_DISMISSED, "1");
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
