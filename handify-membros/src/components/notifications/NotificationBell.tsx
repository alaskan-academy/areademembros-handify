"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { Bell, X, CheckCheck, BookOpen, Play, Award, Newspaper, Megaphone, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/notifications/actions";
import Link from "next/link";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

const TYPE_ICON: Record<string, React.ElementType> = {
  admin_broadcast: Megaphone,
  new_content: BookOpen,
  lesson_completed: Play,
  course_completed: Award,
  certificate_ready: Award,
  news_post: Newspaper,
};

function typeIcon(type: string) {
  return TYPE_ICON[type] ?? Info;
}

function typeColor(type: string) {
  if (type === "admin_broadcast") return "#6699F3";
  if (type === "course_completed" || type === "certificate_ready") return "#72CF92";
  if (type === "news_post") return "#FEC649";
  return "#6699F3";
}

function fmtTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function NotificationBell({
  initialNotifications,
  initialUnread,
  userId,
}: {
  initialNotifications: Notification[];
  initialUnread: number;
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [unread, setUnread] = useState(initialUnread);
  const [, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Realtime: INSERT (nova notificação) e UPDATE (marcar como lida em outro dispositivo)
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as Notification;
          setNotifications((prev) => [n, ...prev]);
          setUnread((c) => c + 1);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as Notification;
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? { ...n, read: updated.read } : n))
          );
          // Recalcula badge a partir do estado atualizado
          setUnread((c) =>
            updated.read ? Math.max(0, c - 1) : c
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  function handleRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnread((c) => Math.max(0, c - 1));
    startTransition(() => { markNotificationRead(id); });
  }

  function handleReadAll() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    startTransition(() => { markAllNotificationsRead(); });
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notificações${unread > 0 ? ` (${unread} não lidas)` : ""}`}
        className="relative p-2 rounded-md text-foreground/50 hover:text-foreground hover:bg-muted transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
            style={{ background: "#6699F3" }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-popover text-foreground border border-border rounded-xl shadow-xl z-50 flex flex-col overflow-hidden"
          style={{ maxHeight: "min(480px, 80vh)" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <span className="font-semibold text-sm">Notificações</span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button onClick={handleReadAll}
                  className="flex items-center gap-1 text-xs text-[#6699F3] hover:text-[#4d7de0] transition-colors"
                  aria-label="Marcar todas como lidas">
                  <CheckCheck className="w-3.5 h-3.5" />
                  Lidas
                </button>
              )}
              <button onClick={() => setOpen(false)}
                className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Fechar">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Lista */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                Nenhuma notificação ainda.
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = typeIcon(n.type);
                const color = typeColor(n.type);
                const content = (
                  <div
                    className={`flex gap-3 px-4 py-3 border-b border-border/40 transition-colors cursor-pointer hover:bg-muted/50 ${!n.read ? "bg-[#6699F3]/5" : ""}`}
                    onClick={() => { if (!n.read) handleRead(n.id); }}
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: color + "20" }}>
                      <Icon className="w-3.5 h-3.5" style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${!n.read ? "font-semibold" : "font-medium"}`}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground/60 mt-1">{fmtTime(n.created_at)}</p>
                    </div>
                    {!n.read && (
                      <div className="w-2 h-2 rounded-full shrink-0 mt-2" style={{ background: "#6699F3" }} />
                    )}
                  </div>
                );

                return n.link ? (
                  <Link key={n.id} href={n.link} onClick={() => { if (!n.read) handleRead(n.id); setOpen(false); }}>
                    {content}
                  </Link>
                ) : (
                  <div key={n.id}>{content}</div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
