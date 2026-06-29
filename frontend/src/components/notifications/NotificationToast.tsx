"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
    bar: "bg-red-500",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800",
    iconColor: "text-yellow-600",
    titleColor: "text-yellow-900 dark:text-yellow-100",
    bar: "bg-yellow-500",
  },
  info: {
    icon: Info,
    bg: "bg-card border-border",
    iconColor: "text-terracotta",
    titleColor: "text-foreground",
    bar: "bg-terracotta",
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
    return () =>
      window.removeEventListener("travelbot:new-notifications", handler as EventListener);
  }, []);

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map(({ id, notification }) => (
          <ToastCard
            key={id}
            notification={notification}
            onDismiss={() => dismiss(id)}
            autoDismissMs={AUTO_DISMISS_MS}
          />
        ))}
      </AnimatePresence>
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
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.9, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className={cn(
        "relative flex items-start gap-3 overflow-hidden rounded-lg border p-3.5 shadow-lg",
        config.bg
      )}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", config.iconColor)} />
      <div className="min-w-0 flex-1">
        <p className={cn("text-[13px] font-semibold leading-snug", config.titleColor)}>
          {notification.title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-[13px] text-foreground/75">
          {notification.body}
        </p>
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 text-foreground/60 transition-colors hover:text-foreground/70"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* Thanh đếm ngược tự đóng */}
      <motion.div
        className={cn("absolute bottom-0 left-0 h-0.5 origin-left", config.bar)}
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: autoDismissMs / 1000, ease: "linear" }}
        style={{ width: "100%" }}
      />
    </motion.div>
  );
}
