"use client";

import { useRef, useState, useEffect } from "react";
import { Bell, AlertTriangle, AlertCircle, Info, Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { useTravelStore } from "@/store/travel-store";
import { useNotifications } from "@/hooks/use-notifications";
import { Notification } from "@/types/notification";
import { apiClient } from "@/lib/api-client";

const SEVERITY_ICON = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};
const SEVERITY_COLOR = {
  critical: "text-red-500",
  warning: "text-[#ff6b00]",
  info: "text-[#146ef5]",
};

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "vừa xong";
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return `${Math.floor(diff / 86400)} ngày trước`;
}

export default function NotificationCenter() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { unreadCount } = useNotifications(); // starts polling
  const notifications = useTravelStore((s) => s.notifications);
  const markRead = useTravelStore((s) => s.markNotificationRead);
  const markAllRead = useTravelStore((s) => s.markAllNotificationsRead);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!session) return null;

  const handleMarkRead = async (n: Notification) => {
    if (n.read) return;
    markRead(n.notification_id);
    await apiClient.patch(`/api/v1/notifications/${n.notification_id}/read`);
  };

  const handleMarkAll = async () => {
    markAllRead();
    await apiClient.post("/api/v1/notifications/mark-all-read", {});
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors",
          "hover:bg-muted text-muted-foreground relative"
        )}
        aria-label="Thông báo"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-10 w-80 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold text-foreground">Thông báo</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAll}
                className="flex items-center gap-1 text-xs text-[#146ef5] hover:underline"
              >
                <CheckCheck className="w-3 h-3" />
                Đánh dấu tất cả đã đọc
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-border">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-sm text-foreground/40">
                Không có thông báo nào
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = SEVERITY_ICON[n.severity] ?? Info;
                return (
                  <button
                    key={n.notification_id}
                    onClick={() => handleMarkRead(n)}
                    className={cn(
                      "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                      !n.read && "bg-blue-50/50 dark:bg-blue-950/10"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-4 h-4 shrink-0 mt-0.5",
                        SEVERITY_COLOR[n.severity] ?? "text-foreground/40"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs font-medium text-foreground line-clamp-2", !n.read && "font-semibold")}>
                        {n.title}
                      </p>
                      <p className="text-xs text-foreground/50 mt-0.5 line-clamp-2">{n.body}</p>
                      <p className="text-[10px] text-foreground/30 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    {n.read && <Check className="w-3 h-3 text-foreground/20 shrink-0 mt-0.5" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
