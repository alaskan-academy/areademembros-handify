"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { Bell, CheckCheck, BookOpen, Play, Award, Newspaper, Megaphone, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/notifications/actions";

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

const TYPE_COLOR: Record<string, string> = {
  admin_broadcast: "#6699F3",
  course_completed: "#72CF92",
  certificate_ready: "#72CF92",
  news_post: "#FEC649",
};

function typeIcon(type: string): React.ElementType {
  return TYPE_ICON[type] ?? Info;
}
function typeColor(type: string): string {
  return TYPE_COLOR[type] ?? "#6699F3";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

type Filter = "all" | "unread";

export default function NotificacoesClient({
  initialNotifications,
  userId,
}: {
  initialNotifications: Notification[];
  userId: string;
}) {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [filter, setFilter] = useState<Filter>("all");
  const [, startTransition] = useTransition();

  // Realtime: novas notificações chegam sem reload
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notif-page:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const updated = payload.new as Notification;
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? { ...n, read: updated.read } : n))
          );
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  function handleRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    startTransition(() => { markNotificationRead(id); });
  }

  function handleReadAll() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    startTransition(() => { markAllNotificationsRead(); });
  }

  const unreadCount = notifications.filter((n) => !n.read).length;
  const visible = filter === "unread" ? notifications.filter((n) => !n.read) : notifications;

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-black">Notificações</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {unreadCount} não {unreadCount === 1 ? "lida" : "lidas"}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleReadAll}
            className="flex items-center gap-1.5 text-sm text-[#6699F3] hover:text-[#4d7de0] transition-colors font-medium"
          >
            <CheckCheck className="w-4 h-4" />
            Marcar todas como lidas
          </button>
        )}
      </div>

      {/* Filtro */}
      <div className="flex gap-2">
        {(["all", "unread"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? "bg-[#6699F3] text-white"
                : "border border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {f === "all" ? "Todas" : `Não lidas${unreadCount > 0 ? ` (${unreadCount})` : ""}`}
          </button>
        ))}
      </div>

      {/* Lista */}
      {visible.length === 0 ? (
        <div className="handify-card p-12 flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Bell className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            {filter === "unread" ? "Nenhuma notificação não lida." : "Nenhuma notificação ainda."}
          </p>
        </div>
      ) : (
        <div className="handify-card overflow-hidden divide-y divide-border/50">
          {visible.map((n) => {
            const Icon = typeIcon(n.type);
            const color = typeColor(n.type);

            const inner = (
              <div
                className={`flex gap-4 px-5 py-4 transition-colors ${
                  !n.read ? "bg-[#6699F3]/[0.04]" : "hover:bg-muted/40"
                }`}
                onClick={() => { if (!n.read) handleRead(n.id); }}
              >
                {/* Ícone */}
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: color + "20" }}
                >
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>

                {/* Conteúdo */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${!n.read ? "font-semibold" : "font-medium"}`}>
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-3">{n.body}</p>
                  )}
                  <p className="text-xs text-muted-foreground/60 mt-1.5">{fmtDate(n.created_at)}</p>
                </div>

                {/* Badge não lida */}
                {!n.read && (
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5"
                    style={{ background: "#6699F3" }}
                  />
                )}
              </div>
            );

            return n.link ? (
              <Link
                key={n.id}
                href={n.link}
                className="block"
                onClick={() => { if (!n.read) handleRead(n.id); }}
              >
                {inner}
              </Link>
            ) : (
              <div key={n.id} className="cursor-default">
                {inner}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
