import { useState, useEffect, useCallback } from "react";

export interface Notification {
  id: string;
  type: "like" | "comment" | "follow" | "achievement" | "message";
  userId: string;
  userName: string;
  userAvatar: string;
  content: string;
  timestamp: number;
  read: boolean;
  link?: string;
}

export function useNotifications(userId: string) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const loadNotifications = useCallback(() => {
    const stored = localStorage.getItem(`youthxp_notifications_${userId}`);
    if (stored) {
      setNotifications(JSON.parse(stored));
    }
  }, [userId]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const handleFollowUpdate = (e: CustomEvent) => {
      if (e.detail.targetUserId === userId && e.detail.action === "follow") {
        // Someone followed the current user
        const followerData = localStorage.getItem("youthxp_users");
        const users = followerData ? JSON.parse(followerData) : [];
        const follower = users.find((u: any) => u.id === e.detail.userId);
        
        if (follower) {
          addNotification({
            type: "follow",
            userId: e.detail.userId,
            userName: follower.name || "Someone",
            userAvatar: follower.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase() || "?",
            content: "started following you",
          });
        }
      }
    };

    const handleNewMessage = (e: CustomEvent) => {
      if (e.detail.recipientId === userId) {
        addNotification({
          type: "message",
          userId: e.detail.senderId,
          userName: e.detail.senderName,
          userAvatar: e.detail.senderAvatar,
          content: "sent you a message",
        });
      }
    };

    const handleLike = (e: CustomEvent) => {
      if (e.detail.ownerId === userId) {
        addNotification({
          type: "like",
          userId: e.detail.likerId,
          userName: e.detail.likerName,
          userAvatar: e.detail.likerAvatar,
          content: `liked your ${e.detail.contentType || "post"}`,
        });
      }
    };

    const handleComment = (e: CustomEvent) => {
      if (e.detail.ownerId === userId) {
        addNotification({
          type: "comment",
          userId: e.detail.commenterId,
          userName: e.detail.commenterName,
          userAvatar: e.detail.commenterAvatar,
          content: `commented on your ${e.detail.contentType || "post"}`,
        });
      }
    };

    window.addEventListener("follow-update", handleFollowUpdate as EventListener);
    window.addEventListener("new-message", handleNewMessage as EventListener);
    window.addEventListener("content-like", handleLike as EventListener);
    window.addEventListener("content-comment", handleComment as EventListener);

    return () => {
      window.removeEventListener("follow-update", handleFollowUpdate as EventListener);
      window.removeEventListener("new-message", handleNewMessage as EventListener);
      window.removeEventListener("content-like", handleLike as EventListener);
      window.removeEventListener("content-comment", handleComment as EventListener);
    };
  }, [userId]);

  const saveNotifications = useCallback((data: Notification[]) => {
    localStorage.setItem(`youthxp_notifications_${userId}`, JSON.stringify(data));
    setNotifications(data);
  }, [userId]);

  const addNotification = useCallback((notification: Omit<Notification, "id" | "timestamp" | "read">) => {
    const newNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      read: false,
    };

    setNotifications(prev => {
      const updated = [newNotification, ...prev].slice(0, 50); // Keep max 50 notifications
      localStorage.setItem(`youthxp_notifications_${userId}`, JSON.stringify(updated));
      return updated;
    });

    // Dispatch event for real-time updates
    window.dispatchEvent(new CustomEvent("notification-added", { detail: newNotification }));
  }, [userId]);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      );
      localStorage.setItem(`youthxp_notifications_${userId}`, JSON.stringify(updated));
      return updated;
    });
  }, [userId]);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      localStorage.setItem(`youthxp_notifications_${userId}`, JSON.stringify(updated));
      return updated;
    });
  }, [userId]);

  const clearNotification = useCallback((notificationId: string) => {
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== notificationId);
      localStorage.setItem(`youthxp_notifications_${userId}`, JSON.stringify(updated));
      return updated;
    });
  }, [userId]);

  const clearAll = useCallback(() => {
    localStorage.removeItem(`youthxp_notifications_${userId}`);
    setNotifications([]);
  }, [userId]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const getTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
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
    addNotification,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAll,
    getTimeAgo,
  };
}
