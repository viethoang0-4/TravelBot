"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useTravelStore } from "@/store/travel-store";
import { Notification } from "@/types/notification";

const BACKEND = "http://localhost:8000";
const POLL_INTERVAL_MS = 30_000;

export function useNotifications() {
  const { data: session } = useSession();
  const token = session?.backendToken;

  const setNotifications = useTravelStore((s) => s.setNotifications);
  const notifications = useTravelStore((s) => s.notifications);

  const prevIdsRef = useRef<Set<string>>(new Set());
  const toastQueueRef = useRef<Notification[]>([]);

  const fetchNotifications = useCallback(async () => {
    if (!token || document.visibilityState !== "visible") return;

    try {
      const res = await fetch(`${BACKEND}/api/v1/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;

      const data: Notification[] = await res.json();
      setNotifications(data);

      // Queue new unread notifications for toast
      const newUnread = data.filter(
        (n) => !n.read && !prevIdsRef.current.has(n.notification_id)
      );
      if (newUnread.length > 0) {
        toastQueueRef.current = newUnread;
        window.dispatchEvent(new CustomEvent("travelbot:new-notifications", { detail: newUnread }));
      }

      // Update seen set
      prevIdsRef.current = new Set(data.map((n) => n.notification_id));
    } catch {
      // Silent fail — backend may be down
    }
  }, [token, setNotifications]);

  useEffect(() => {
    if (!token) return;

    fetchNotifications();

    const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchNotifications();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [token, fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount };
}
