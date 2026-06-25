"use client";

import { useState, useEffect, useTransition } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { subscribePush, unsubscribePush } from "@/lib/push/actions";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

interface Props {
  initialEndpoints: string[];
}

export default function PushSubscribeButton({ initialEndpoints }: Props) {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [activeEndpoint, setActiveEndpoint] = useState<string | null>(
    initialEndpoints[0] ?? null
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;
    setSupported(ok);
    if (ok) setPermission(Notification.permission);

    // Verifica se a subscription atual ainda é válida neste dispositivo
    if (ok && initialEndpoints.length > 0) {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => {
          if (!sub) {
            // Browser não tem subscription ativa — limpa estado local
            setActiveEndpoint(null);
          } else if (!initialEndpoints.includes(sub.endpoint)) {
            // Subscription diferente — atualiza
            setActiveEndpoint(sub.endpoint);
          }
        })
        .catch(() => setActiveEndpoint(null));
    }
  }, [initialEndpoints]);

  async function handleEnable() {
    setError(null);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setError("Permissão negada. Habilite nas configurações do navegador.");
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
          setError(result.error ?? "Erro ao ativar.");
        } else {
          setActiveEndpoint(json.endpoint);
        }
      });
    } catch {
      setError("Não foi possível ativar as notificações.");
    }
  }

  async function handleDisable() {
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();

      if (activeEndpoint) {
        startTransition(async () => {
          await unsubscribePush(activeEndpoint);
          setActiveEndpoint(null);
        });
      } else {
        setActiveEndpoint(null);
      }
    } catch {
      setError("Erro ao desativar.");
    }
  }

  if (!supported) return null;

  const isActive = !!activeEndpoint;
  const isBlocked = permission === "denied";

  return (
    <div className="space-y-1">
      <button
        onClick={isActive ? handleDisable : handleEnable}
        disabled={isPending || isBlocked}
        className={`flex items-center gap-2.5 w-full px-4 py-3 rounded-lg border text-sm font-medium transition-colors min-h-[44px]
          ${isActive
            ? "border-[#72CF92] bg-[#72CF92]/8 text-[#2D2D2D] hover:bg-[#72CF92]/15"
            : isBlocked
              ? "border-border bg-muted text-muted-foreground cursor-not-allowed"
              : "border-[#6699F3] bg-[#6699F3]/8 text-[#6699F3] hover:bg-[#6699F3]/15"
          }`}
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        ) : isActive ? (
          <BellOff className="w-4 h-4 shrink-0 text-[#72CF92]" />
        ) : (
          <Bell className="w-4 h-4 shrink-0" />
        )}
        <span>
          {isPending
            ? "Aguarde…"
            : isActive
              ? "Notificações push ativas — clique para desativar"
              : isBlocked
                ? "Notificações bloqueadas no navegador"
                : "Ativar notificações push"}
        </span>
        {isActive && (
          <span className="ml-auto w-2 h-2 rounded-full bg-[#72CF92] shrink-0" />
        )}
      </button>

      {isBlocked && (
        <p className="text-xs text-muted-foreground px-1">
          Para ativar, permita notificações nas configurações do seu navegador.
        </p>
      )}
      {error && (
        <p className="text-xs text-red-600 px-1">{error}</p>
      )}
    </div>
  );
}
