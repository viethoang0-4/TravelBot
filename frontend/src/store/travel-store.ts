"use client";

import { create } from "zustand";
import {
  ChatMessage,
  Itinerary,
  ItineraryDraft,
  RightPanelTab,
} from "@/types/travel";
import { Notification } from "@/types/notification";
import { nanoid } from "@/lib/utils";

/** Các bước hiển thị trên Skeleton screen khi đang lập kế hoạch */
export type PlanningStep =
  | "intent"
  | "search_hotel"
  | "search_attraction"
  | "optimize_route"
  | "calculate_budget"
  | "finalize";

interface TravelStore {
  // ── Chat ──────────────────────────────────────────────
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingText: string;
  streamingStatus: string;

  /**
   * Khi true → ItineraryPanel sẽ render Skeleton thay vì timeline thật.
   * Set true khi user gửi yêu cầu lập kế hoạch, set false khi nhận xong.
   */
  isPlanning: boolean;
  /** Bước hiện tại trong skeleton (driven bởi heuristic + thời gian) */
  planningStep: PlanningStep;

  // ── Drafts (danh sách lịch trình) ─────────────────────
  drafts: ItineraryDraft[];
  /** ID của draft đang được hiển thị trên Right Panel */
  activeDraftId: string | null;

  // ── Selection / hover ─────────────────────────────────
  selectedActivityId: string | null;
  /** ID activity đang được hover (Timeline ↔ Map sync) */
  hoveredActivityId: string | null;

  // ── Notifications ─────────────────────────────────────
  notifications: Notification[];

  // ── UI ────────────────────────────────────────────────
  activeTab: RightPanelTab;
  isMobileChatOpen: boolean;

  // ── Chat actions ──────────────────────────────────────
  addMessage: (msg: ChatMessage) => void;
  updateLastAssistantMessage: (content: string) => void;
  setIsStreaming: (v: boolean) => void;
  setStreamingText: (v: string) => void;
  setStreamingStatus: (v: string) => void;
  clearMessages: () => void;

  // ── Planning skeleton ─────────────────────────────────
  startPlanning: () => void;
  setPlanningStep: (step: PlanningStep) => void;
  stopPlanning: () => void;

  // ── Itinerary / Drafts actions ────────────────────────
  /**
   * Tạo draft mới từ một Itinerary (vd: vừa nhận từ stream).
   * Tự động set draft này thành active.
   */
  addDraft: (itinerary: Itinerary) => void;
  /** Ghi đè itinerary của một draft (vd: sau khi user kéo thả) */
  updateDraftItinerary: (draftId: string, itinerary: Itinerary) => void;
  /** Chuyển draft đang active — KHÔNG xoá lịch sử chat */
  switchDraft: (draftId: string) => void;
  /** Xoá draft */
  deleteDraft: (draftId: string) => void;
  /** "Chốt" draft → status = "confirmed" */
  confirmDraft: (draftId: string) => void;
  /** Bỏ chốt (về trạng thái nháp) */
  unconfirmDraft: (draftId: string) => void;

  // ── Selection ─────────────────────────────────────────
  setSelectedActivity: (id: string | null) => void;
  setHoveredActivity: (id: string | null) => void;

  // ── Notifications ─────────────────────────────────────
  setNotifications: (notifications: Notification[]) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  // ── UI ────────────────────────────────────────────────
  setActiveTab: (tab: RightPanelTab) => void;
  setMobileChatOpen: (v: boolean) => void;
}

const nowIso = () => new Date().toISOString();

export const useTravelStore = create<TravelStore>((set, get) => ({
  // Chat
  messages: [],
  isStreaming: false,
  streamingText: "",
  streamingStatus: "",
  isPlanning: false,
  planningStep: "intent",

  // Drafts
  drafts: [],
  activeDraftId: null,

  // Selection
  selectedActivityId: null,
  hoveredActivityId: null,

  // Notifications
  notifications: [],

  // UI
  activeTab: "timeline",
  isMobileChatOpen: true,

  // Chat actions
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

  updateLastAssistantMessage: (content) =>
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === "assistant") {
        msgs[msgs.length - 1] = { ...last, content };
      }
      return { messages: msgs };
    }),

  setIsStreaming: (isStreaming) => set({ isStreaming }),
  setStreamingText: (streamingText) => set({ streamingText }),
  setStreamingStatus: (streamingStatus) => set({ streamingStatus }),

  clearMessages: () =>
    set({
      messages: [],
      // KHÔNG xoá drafts — user có thể muốn giữ lịch trình đã tạo
      selectedActivityId: null,
      hoveredActivityId: null,
    }),

  // Planning skeleton
  startPlanning: () => set({ isPlanning: true, planningStep: "intent" }),
  setPlanningStep: (planningStep) => set({ planningStep }),
  stopPlanning: () => set({ isPlanning: false, planningStep: "finalize" }),

  // Drafts
  addDraft: (itinerary) =>
    set((s) => {
      const draft: ItineraryDraft = {
        draft_id: nanoid(10),
        itinerary,
        status: "draft",
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      return {
        drafts: [...s.drafts, draft],
        activeDraftId: draft.draft_id,
        activeTab: "timeline",
      };
    }),

  updateDraftItinerary: (draftId, itinerary) =>
    set((s) => ({
      drafts: s.drafts.map((d) =>
        d.draft_id === draftId
          ? { ...d, itinerary, updated_at: nowIso() }
          : d
      ),
    })),

  switchDraft: (draftId) => {
    const exists = get().drafts.some((d) => d.draft_id === draftId);
    if (!exists) return;
    set({
      activeDraftId: draftId,
      selectedActivityId: null,
      hoveredActivityId: null,
      activeTab: "timeline",
    });
  },

  deleteDraft: (draftId) =>
    set((s) => {
      const newDrafts = s.drafts.filter((d) => d.draft_id !== draftId);
      const newActive =
        s.activeDraftId === draftId
          ? newDrafts[newDrafts.length - 1]?.draft_id ?? null
          : s.activeDraftId;
      return { drafts: newDrafts, activeDraftId: newActive };
    }),

  confirmDraft: (draftId) =>
    set((s) => ({
      drafts: s.drafts.map((d) =>
        d.draft_id === draftId
          ? { ...d, status: "confirmed", updated_at: nowIso() }
          : d
      ),
    })),

  unconfirmDraft: (draftId) =>
    set((s) => ({
      drafts: s.drafts.map((d) =>
        d.draft_id === draftId
          ? { ...d, status: "draft", updated_at: nowIso() }
          : d
      ),
    })),

  // Selection
  setSelectedActivity: (selectedActivityId) => set({ selectedActivityId }),
  setHoveredActivity: (hoveredActivityId) => set({ hoveredActivityId }),

  // Notifications
  setNotifications: (notifications) => set({ notifications }),
  markNotificationRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.notification_id === id ? { ...n, read: true } : n
      ),
    })),
  markAllNotificationsRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    })),

  // UI
  setActiveTab: (activeTab) => set({ activeTab }),
  setMobileChatOpen: (isMobileChatOpen) => set({ isMobileChatOpen }),
}));

/** Helper selector — lấy itinerary đang active từ drafts */
export function useActiveItinerary(): Itinerary | null {
  return useTravelStore((s) => {
    if (!s.activeDraftId) return null;
    return s.drafts.find((d) => d.draft_id === s.activeDraftId)?.itinerary ?? null;
  });
}

/** Helper selector — lấy draft đang active */
export function useActiveDraft(): ItineraryDraft | null {
  return useTravelStore((s) => {
    if (!s.activeDraftId) return null;
    return s.drafts.find((d) => d.draft_id === s.activeDraftId) ?? null;
  });
}
