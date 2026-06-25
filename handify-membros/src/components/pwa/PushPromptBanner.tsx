"use client";

import { useState, useEffect, useTransition } from "react";
import { Bell, X, Loader2 } from "lucide-react";
import { subscribePush } from "@/lib/push/actions";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const LS_KEY = "handify_push_prompt_dismissed_at";
const PROMPT_INTERVAL_DAYS = 15;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function PushPromptBanner() {
  const [visible, setVisible] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Verifica suporte
    const supported =
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;
    if (!supported) return;

    // Permissão já negada → nunca mostrar
    if (Notification.permission === "denied") return;

    // Verifica se já tem subscription ativa neste dispositivo
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (sub) return; // Já ativo neste dispositivo — não mostrar

        // Permissão já concedida mas sem subscription (dispositivo novo):
        // mostrar imediatamente para reativar
        if (Notification.permission === "granted") {
          setVisible(true);
          return;
        }

        // Permissão default — verificar intervalo de 15 dias
        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
          const dismissed = parseInt(raw, 10);
          const daysSince = (Date.now() - dismissed) / (1000 * 60 * 60 * 24);
          if (daysSince < PROMPT_INTERVAL_DAYS) return;
        }
        setVisible(true);
      })
      .catch(() => {/* SW não disponível ainda */});
  }, []);

  function dismiss() {
    localStorage.setItem(LS_KEY, String(Date.now()));
    setVisible(false);
  }

  async function handleEnable() {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        dismiss();
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as ArrayBuffer,
      });

      const json = sub.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };

      startTransition(async () => {
        await subscribePush(json);
        setDone(true);
        setTimeout(() => setVisible(false), 1800);
      });
    } catch {
      dismiss();
    }
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Ativar notificações push"
      className="fixed bottom-20 md:bottom-6 right-4 z-40 w-[min(320px,calc(100vw-2rem))] handify-card p-4 shadow-lg border border-border/60 animate-in slide-in-from-bottom-4 fade-in duration-300"
    >
      {/* Botão fechar */}
      <button
        onClick={dismiss}
        className="absolute top-2.5 right-2.5 p-1 rounded-md text-muted-foreground hover:bg-muted transition-colors"
        aria-label="Fechar"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#6699F3]/10 flex items-center justify-center shrink-0">
          <Bell className="w-4 h-4 text-[#6699F3]" />
        </div>
        <div className="flex-1 min-w-0 pr-4">
          {done ? (
            <p className="text-sm font-semibold text-[#72CF92]">
              Notificações ativadas!
            </p>
          ) : (
            <>
              <p className="text-sm font-semibold leading-snug">
                Ativar notificações?
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Receba avisos sobre novos conteúdos e novidades da Handify.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleEnable}
                  disabled={isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#6699F3] hover:bg-[#5580d4] transition-colors disabled:opacity-60"
                >
                  {isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Bell className="w-3 h-3" />
                  )}
                  Ativar
                </button>
                <button
                  onClick={dismiss}
                  className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  Agora não
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
