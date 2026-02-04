import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";

export interface Notification {
  id: string;
  type: string;
  title?: string | null;
  body: string;
  link?: string | null;
  meta?: any;
  readAt?: string | null;
  createdAt: string;
}

export function useNotifications(userId: string) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const refresh = useCallback(async () => {
    if (!userId || userId === "guest") {
      setNotifications([]);
      return;
    }
    const d = await apiFetch<{ notifications: Notification[] }>("/community/notifications");
    setNotifications(Array.isArray(d?.notifications) ? d.notifications : []);
  }, [userId]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const markAsRead = useCallback(
    (notificationId: string) => {
      if (!userId || userId === "guest") return;
      setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n)));
      apiFetch(`/community/notifications/${notificationId}/read`, { method: "POST" })
        .then(() => {
          refresh().catch(() => {});
        })
        .catch(() => {});
    },
    [userId, refresh],
  );

  const markAllAsRead = useCallback(() => {
    if (!userId || userId === "guest") return;
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    apiFetch("/community/notifications/read-all", { method: "POST" })
      .then(() => refresh().catch(() => {}))
      .catch(() => {});
  }, [userId, refresh]);

  const clearNotification = useCallback(
    (notificationId: string) => {
      if (!userId || userId === "guest") return;
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      apiFetch(`/community/notifications/${notificationId}`, { method: "DELETE" })
        .then(() => refresh().catch(() => {}))
        .catch(() => {});
    },
    [userId, refresh],
  );

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const getTimeAgo = (timestamp: number | string): string => {
    const ts = typeof timestamp === "string" ? new Date(timestamp).getTime() : timestamp;
    const seconds = Math.floor((Date.now() - ts) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return {
    notifications,
    unreadCount,
    refresh,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAll,
    getTimeAgo,
  };
}
