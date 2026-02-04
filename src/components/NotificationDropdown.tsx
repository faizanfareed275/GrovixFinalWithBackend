import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Heart, MessageCircle, UserPlus, Trophy, X, Check, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { useNavigate } from "react-router-dom";

const notificationIcons = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  achievement: Trophy,
  message: Mail,
};

const notificationColors = {
  like: "text-destructive bg-destructive/20",
  comment: "text-primary bg-primary/20",
  follow: "text-secondary bg-secondary/20",
  achievement: "text-level-gold bg-level-gold/20",
  message: "text-accent bg-accent/20",
};

export function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    clearNotification,
    getTimeAgo 
  } = useNotifications(user?.id || "guest");

  const handleOpenLink = (link: string | null | undefined) => {
    if (!link) return;
    const s = String(link);
    if (s.startsWith("http://") || s.startsWith("https://")) {
      window.open(s, "_blank", "noopener,noreferrer");
      return;
    }
    navigate(s);
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-muted rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown Panel */}
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 top-full mt-2 w-80 sm:w-96 glass-card z-50 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="font-display font-bold">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    <Check className="w-4 h-4" />
                    Mark all read
                  </button>
                )}
              </div>

              {/* Notifications List */}
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No notifications yet</p>
                  </div>
                ) : (
                  notifications.map((notification) => {
                    const Icon = (notificationIcons as any)[notification.type] || Bell;
                    const colorClass = (notificationColors as any)[notification.type] || "text-muted-foreground bg-muted";
                    const primaryText = notification.title || "Notification";
                    const secondaryText = notification.body;
                    const avatarInitials = (notification.meta && (notification.meta as any).actorName)
                      ? String((notification.meta as any).actorName).split(" ").map((n: string) => n[0]).join("").toUpperCase()
                      : "";
                    const createdAt = notification.createdAt;
                    return (
                      <motion.div
                        key={notification.id}
                        layout
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        onClick={() => {
                          markAsRead(notification.id);
                          handleOpenLink(notification.link);
                          setIsOpen(false);
                        }}
                        className={`flex items-start gap-3 p-4 border-b border-border cursor-pointer transition-colors hover:bg-muted/50 group ${
                          !notification.readAt ? "bg-primary/5" : ""
                        }`}
                      >
                        {/* Avatar */}
                        <div className="relative shrink-0">
                          <UserAvatar initials={avatarInitials} size="sm" className="w-10 h-10" />
                          <div
                            className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ${colorClass}`}
                          >
                            <Icon className="w-3 h-3" />
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">
                            <span className="font-semibold">{primaryText}</span>{" "}
                            <span className="text-muted-foreground">{secondaryText}</span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {getTimeAgo(createdAt)}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {!notification.readAt && (
                            <div className="w-2 h-2 bg-primary rounded-full" />
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              clearNotification(notification.id);
                            }}
                            className="p-1 hover:bg-muted rounded transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <X className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-border">
                <Button variant="ghost" className="w-full text-sm">
                  View all notifications
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
