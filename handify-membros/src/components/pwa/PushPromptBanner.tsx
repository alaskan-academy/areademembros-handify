"use client";

import { useState, useEffect, useTransition } from "react";
import { Bell, X, Loader2 } from "lucide-react";
import { subscribePush } from "@/lib/push/actions";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
// Compartilhada com PushSubscribeButton — não alterar o nome
const LS_ACTIVATED = "handify_push_activated";
const LS_DISMISSED = "handify_push_dismissed_at";
const INTERVAL_MS = 15 * 24 * 60 * 60 * 1000; // 15 dias em ms

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
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const supported =
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;
    if (!supported) return;

    const perm = Notification.permission;

    // Permissão negada → nunca mostrar
    if (perm === "denied") return;

    // Permissão concedida E flag de ativação presente → já ativou neste dispositivo
    if (perm === "granted" && localStorage.getItem(LS_ACTIVATED) === "true") return;

    // Permissão padrão (nunca pediu) → verificar intervalo de 15 dias de forma síncrona
    if (perm === "default") {
      const raw = localStorage.getItem(LS_DISMISSED);
      if (raw) {
        const elapsed = Date.now() - parseInt(raw, 10);
        if (elapsed < INTERVAL_MS) return; // Ainda dentro dos 15 dias
      }
      setVisible(true);
      return;
    }

    // Permissão concedida mas sem flag local → pode ser novo dispositivo ou sessão antiga
    // Verifica via Service Worker se há subscription ativa
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (sub) {
          // Subscription ativa → salva flag retroativamente e não mostra
          localStorage.setItem(LS_ACTIVATED, "true");
        } else {
          // Sem subscription neste dispositivo → mostra para reativar
          setVisible(true);
        }
      })
      .catch(() => { /* SW não disponível — silencioso */ });
  }, []);

  function dismiss() {
    localStorage.setItem(LS_DISMISSED, String(Date.now()));
    setVisible(false);
  }

  async function handleEnable() {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        // Usuária recusou o diálogo do browser → trata como dismiss
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
        const result = await subscribePush(json);
        if ("error" in result) {
          setSaveError("Não foi possível salvar. Tente novamente.");
          return;
        }
        localStorage.setItem(LS_ACTIVATED, "true");
        localStorage.removeItem(LS_DISMISSED);
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
              {saveError && (
                <p className="text-xs text-red-600 mt-2">{saveError}</p>
              )}
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
