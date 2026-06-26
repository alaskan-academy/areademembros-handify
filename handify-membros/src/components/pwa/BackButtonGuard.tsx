"use client";

import { useEffect, useRef, useState } from "react";

const GUARD_KEY = "__handify_guard";
const COOLDOWN_MS = 2000;

export default function BackButtonGuard() {
  const [showToast, setShowToast] = useState(false);
  const lastPressRef = useRef(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Sentinela no início do stack — quando o usuário voltar até aqui estaria saindo do app
    history.pushState({ [GUARD_KEY]: true }, "");

    function onPopState(event: PopStateEvent) {
      if (!event.state?.[GUARD_KEY]) return;

      const now = Date.now();

      if (now - lastPressRef.current < COOLDOWN_MS) {
        // Segunda vez dentro de 2s → tentar fechar o app
        window.close();
        // Fallback: se window.close() não funcionar (instalado como PWA)
        history.go(-(history.length - 1));
      } else {
        // Primeira vez → mostra aviso e reinsere a sentinela
        lastPressRef.current = now;
        history.pushState({ [GUARD_KEY]: true }, "");
        setShowToast(true);

        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
          setShowToast(false);
          lastPressRef.current = 0;
        }, COOLDOWN_MS);
      }
    }

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  if (!showToast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none"
    >
      <div className="bg-[#0F0F0F]/90 backdrop-blur-sm text-white text-sm font-medium px-5 py-3 rounded-full shadow-lg whitespace-nowrap animate-in fade-in slide-in-from-bottom-2 duration-200">
        Pressione novamente para sair
      </div>
    </div>
  );
}
