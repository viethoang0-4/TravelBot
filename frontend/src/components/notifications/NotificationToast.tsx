"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Notification } from "@/types/notification";

interface ToastItem {
  id: string;
  notification: Notification;
}

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertCircle,
    bg: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800",
    iconColor: "text-red-600",
    titleColor: "text-red-900 dark:text-red-100",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800",
    iconColor: "text-[#ff6b00]",
    titleColor: "text-orange-900 dark:text-orange-100",
  },
  info: {
    icon: Info,
    bg: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800",
    iconColor: "text-[#146ef5]",
    titleColor: "text-blue-900 dark:text-blue-100",
  },
};

const AUTO_DISMISS_MS = 6000;

export default function NotificationToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (e: CustomEvent<Notification[]>) => {
      const newToasts: ToastItem[] = e.detail.map((n) => ({
        id: n.notification_id,
        notification: n,
      }));
      setToasts((prev) => [...prev, ...newToasts].slice(-3)); // max 3 visible
    };

    window.addEventListener("travelbot:new-notifications", handler as EventListener);
    return () => window.removeEventListener("travelbot:new-notifications", handler as EventListener);
  }, []);

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80">
      {toasts.map(({ id, notification }) => (
        <ToastCard
          key={id}
          notification={notification}
          onDismiss={() => dismiss(id)}
          autoDismissMs={AUTO_DISMISS_MS}
        />
      ))}
    </div>
  );
}

function ToastCard({
  notification,
  onDismiss,
  autoDismissMs,
}: {
  notification: Notification;
  onDismiss: () => void;
  autoDismissMs: number;
}) {
  const config = SEVERITY_CONFIG[notification.severity] ?? SEVERITY_CONFIG.info;
  const Icon = config.icon;

  useEffect(() => {
    const t = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(t);
  }, [onDismiss, autoDismissMs]);

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3.5 rounded-lg border shadow-lg animate-in slide-in-from-right-5 duration-300",
        config.bg
      )}
    >
      <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", config.iconColor)} />
      <div className="flex-1 min-w-0">
        <p className={cn("text-xs font-semibold leading-snug", config.titleColor)}>
          {notification.title}
        </p>
        <p className="text-xs text-foreground/60 mt-0.5 line-clamp-2">{notification.body}</p>
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 text-foreground/40 hover:text-foreground/70 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
