"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { apiClient } from "@/lib/api-client";
import { useTravelStore, deserializeMessages } from "@/store/travel-store";
import { ChatMessage, Itinerary, ItineraryDraft } from "@/types/travel";

/**
 * Loads the signed-in user's saved itineraries from the backend once after
 * authentication, hydrating them into the drafts store (with their confirmed
 * status). Renders nothing.
 */
export default function ItineraryHydrator() {
  const { status } = useSession();
  const setDrafts = useTravelStore((s) => s.setDrafts);
  const loaded = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || loaded.current) return;
    loaded.current = true;

    (async () => {
      try {
        const res = await apiClient.get("/api/v1/itineraries");
        if (!res.ok) return;
        const items = (await res.json()) as Array<
          Itinerary & { status?: string; messages?: unknown }
        >;
        const drafts: ItineraryDraft[] = [];
        const messagesByDraft: Record<string, ChatMessage[]> = {};
        for (const it of items) {
          const ts = it.meta?.generated_at ?? new Date().toISOString();
          // Tách phần lưu kèm (status, messages) ra khỏi object itinerary
          const { status, messages, ...itinerary } = it;
          drafts.push({
            draft_id: it.itinerary_id,
            itinerary: itinerary as Itinerary,
            status: status === "confirmed" ? "confirmed" : "draft",
            created_at: ts,
            updated_at: ts,
          });
          messagesByDraft[it.itinerary_id] = deserializeMessages(messages);
        }
        // KHÔNG auto-focus: setDrafts giữ activeDraftId = null khi mới vào
        setDrafts(drafts, messagesByDraft);
      } catch (e) {
        console.error("[hydrate] load itineraries failed", e);
      }
    })();
  }, [status, setDrafts]);

  return null;
}
