"use client";

import { create } from "zustand";
import {
  ChatMessage,
  ClarifyPayload,
  Itinerary,
  ItineraryDraft,
  PlanStage,
  RightPanelTab,
} from "@/types/travel";
import { Notification } from "@/types/notification";
import { nanoid } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";

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
   * Bộ câu hỏi làm rõ đang chờ người dùng trả lời (do clarify agent gửi qua SSE).
   * null khi không có câu hỏi nào đang chờ.
   */
  pendingClarify: ClarifyPayload | null;

  /**
   * Lịch sử trò chuyện của TỪNG lịch trình (theo draft_id) — bản lưu của các draft
   * KHÔNG đang active. Conversation của draft đang active là `messages` (live).
   * Hydrate từ backend lúc đăng nhập, được lưu ngược lên backend sau mỗi lượt chat.
   */
  messagesByDraft: Record<string, ChatMessage[]>;

  /**
   * Khi true → ItineraryPanel sẽ render Skeleton thay vì timeline thật.
   * Set true khi user gửi yêu cầu lập kế hoạch, set false khi nhận xong.
   */
  isPlanning: boolean;
  /** Bước hiện tại trong skeleton (driven bởi heuristic + thời gian) */
  planningStep: PlanningStep;

  /**
   * Mốc hoàn thiện của lịch trình đang được stream (progressive rendering).
   * null = không stream / đã xong. Khi khác null & != "ready" → timeline khoá
   * sửa/chốt + hiện dải "đang xác thực..." (tránh chốt bản chưa neo tọa độ/tuyến).
   */
  planStage: PlanStage | null;
  /** ID của draft đang được stream — để khoá ĐÚNG thẻ đó (không khoá nhầm thẻ khác nếu user chuyển) */
  streamingDraftId: string | null;

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
  setPendingClarify: (v: ClarifyPayload | null) => void;
  clearMessages: () => void;
  /** Bắt đầu cuộc trò chuyện mới: bỏ chọn lịch trình, dọn khung chat (KHÔNG xoá lịch sử đã lưu) */
  newConversation: () => void;
  /** Lưu cuộc trò chuyện của lịch trình đang active lên backend (gọi sau mỗi lượt chat) */
  persistActiveConversation: () => void;

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
  /**
   * Áp itinerary nhận theo LUỒNG (progressive) vào draft: tạo mới nếu chưa có, ngược lại
   * cập nhật TẠI CHỖ theo itinerary_id. KHÔNG lưu backend (chỉ lưu 1 lần ở cuối lượt chat
   * qua persistActiveConversation) → tránh POST thừa ở mỗi mốc drafting/enriching.
   */
  applyStreamingItinerary: (itinerary: Itinerary, stage: PlanStage) => void;
  /** Đặt mốc hoàn thiện của lịch trình đang stream (null = xong/không stream) */
  setPlanStage: (stage: PlanStage | null) => void;
  /** Thay toàn bộ danh sách drafts + lịch sử chat (vd: hydrate từ backend khi đăng nhập) */
  setDrafts: (
    drafts: ItineraryDraft[],
    messagesByDraft?: Record<string, ChatMessage[]>
  ) => void;
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

// ── Backend sync (fire-and-forget; the store updates optimistically) ──────
// The "status" (draft/confirmed) AND the conversation history are stored
// alongside the itinerary on the backend so they survive logout/login.

/** Hình thái message tối giản để lưu (bỏ ảnh base64 + itinerary lồng nhau cho nhẹ) */
interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string; // ISO
}

function serializeMessages(messages: ChatMessage[]): StoredMessage[] {
  return messages
    .filter((m) => (m.content ?? "").trim()) // bỏ message rỗng (placeholder assistant)
    .map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: (m.timestamp instanceof Date
        ? m.timestamp
        : new Date(m.timestamp)
      ).toISOString(),
    }));
}

/** Khôi phục messages từ dạng đã lưu (timestamp string → Date) */
export function deserializeMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m) => m && typeof m.content === "string")
    .map((m) => ({
      id: m.id ?? nanoid(),
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
      timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
    }));
}

async function persistDraft(
  draft: ItineraryDraft,
  messages: ChatMessage[]
): Promise<void> {
  try {
    await apiClient.post("/api/v1/itineraries", {
      ...draft.itinerary,
      status: draft.status,
      messages: serializeMessages(messages),
    });
  } catch (e) {
    console.error("[drafts] persist failed", e);
  }
}

/** Lưu 1 draft kèm đúng conversation của nó (active → messages live, còn lại → messagesByDraft) */
function persistDraftFromState(state: TravelStore, draftId: string): void {
  const draft = state.drafts.find((d) => d.draft_id === draftId);
  if (!draft) return;
  const msgs =
    state.activeDraftId === draftId
      ? state.messages
      : state.messagesByDraft[draftId] ?? [];
  persistDraft(draft, msgs);
}

async function removeDraftFromBackend(itineraryId?: string): Promise<void> {
  if (!itineraryId) return;
  try {
    await apiClient.delete(`/api/v1/itineraries/${itineraryId}`);
  } catch (e) {
    console.error("[drafts] delete failed", e);
  }
}

function emitToast(notification: Notification): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("travelbot:new-notifications", { detail: [notification] })
  );
}

export const useTravelStore = create<TravelStore>((set, get) => ({
  // Chat
  messages: [],
  isStreaming: false,
  streamingText: "",
  streamingStatus: "",
  pendingClarify: null,
  messagesByDraft: {},
  isPlanning: false,
  planningStep: "intent",
  planStage: null,
  streamingDraftId: null,

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
  setPendingClarify: (pendingClarify) => set({ pendingClarify }),

  // "Xóa hội thoại": dọn chat của cuộc trò chuyện đang xem. Nếu đang gắn với 1 lịch
  // trình thì xoá luôn lịch sử đã lưu của lịch trình đó (cả trên backend). KHÔNG xoá drafts.
  clearMessages: () => {
    set((s) => {
      const byDraft = { ...s.messagesByDraft };
      if (s.activeDraftId) byDraft[s.activeDraftId] = [];
      return {
        messages: [],
        messagesByDraft: byDraft,
        pendingClarify: null,
        selectedActivityId: null,
        hoveredActivityId: null,
      };
    });
    const st = get();
    if (st.activeDraftId) persistDraftFromState(st, st.activeDraftId);
  },

  // Bắt đầu cuộc trò chuyện mới: cất conversation hiện tại, bỏ chọn lịch trình, dọn khung chat.
  // KHÔNG xoá lịch sử đã lưu (vẫn có thể bấm lại lịch trình để xem).
  newConversation: () =>
    set((s) => {
      const byDraft = { ...s.messagesByDraft };
      if (s.activeDraftId) byDraft[s.activeDraftId] = s.messages;
      return {
        activeDraftId: null,
        messages: [],
        messagesByDraft: byDraft,
        pendingClarify: null,
        selectedActivityId: null,
        hoveredActivityId: null,
      };
    }),

  persistActiveConversation: () => {
    const st = get();
    if (st.activeDraftId) persistDraftFromState(st, st.activeDraftId);
  },

  // Planning skeleton
  startPlanning: () => set({ isPlanning: true, planningStep: "intent" }),
  setPlanningStep: (planningStep) => set({ planningStep }),
  stopPlanning: () => set({ isPlanning: false, planningStep: "finalize" }),

  // Drafts
  addDraft: (itinerary) =>
    set((s) => {
      // draft_id = itinerary_id để đồng nhất với backend + hydrate (lưu/khôi phục chat theo id này)
      const draftId = itinerary.itinerary_id;
      const draft: ItineraryDraft = {
        draft_id: draftId,
        itinerary,
        status: "draft",
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      // Cuộc trò chuyện hiện tại (`messages`) trở thành lịch sử của lịch trình vừa tạo.
      return {
        drafts: [...s.drafts.filter((d) => d.draft_id !== draftId), draft],
        activeDraftId: draftId,
        activeTab: "timeline",
      };
    }),

  applyStreamingItinerary: (itinerary, stage) =>
    set((s) => {
      const draftId = itinerary.itinerary_id;
      const exists = s.drafts.some((d) => d.draft_id === draftId);
      if (exists) {
        // Cập nhật tại chỗ (giữ status/created_at của thẻ đang hiển thị).
        return {
          drafts: s.drafts.map((d) =>
            d.draft_id === draftId
              ? { ...d, itinerary, updated_at: nowIso() }
              : d
          ),
          planStage: stage,
          streamingDraftId: draftId,
        };
      }
      // Lần đầu (mốc drafting): tạo thẻ + set active + nhảy sang tab lịch trình,
      // KHÔNG lưu backend (persist ở cuối lượt). Conversation live (`messages`) giữ nguyên.
      const draft: ItineraryDraft = {
        draft_id: draftId,
        itinerary,
        status: "draft",
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      return {
        drafts: [...s.drafts.filter((d) => d.draft_id !== draftId), draft],
        activeDraftId: draftId,
        activeTab: "timeline",
        planStage: stage,
        streamingDraftId: draftId,
      };
    }),

  // Đặt null (cuối lượt / lỗi) → xoá luôn thẻ đang stream để mở khoá.
  setPlanStage: (planStage) =>
    set(planStage === null ? { planStage: null, streamingDraftId: null } : { planStage }),

  setDrafts: (drafts, messagesByDraft = {}) =>
    set((s) => {
      // Mới vào KHÔNG auto-focus: chỉ giữ active nếu nó vẫn còn, ngược lại để null (chưa chọn gì).
      const keepActive = drafts.some((d) => d.draft_id === s.activeDraftId);
      return {
        drafts,
        messagesByDraft,
        activeDraftId: keepActive ? s.activeDraftId : null,
        messages: keepActive ? s.messages : [],
      };
    }),

  updateDraftItinerary: (draftId, itinerary) => {
    set((s) => ({
      drafts: s.drafts.map((d) =>
        d.draft_id === draftId
          ? { ...d, itinerary, updated_at: nowIso() }
          : d
      ),
    }));
    persistDraftFromState(get(), draftId); // save reordered/edited itinerary (+ chat)
  },

  switchDraft: (draftId) => {
    const st = get();
    if (draftId === st.activeDraftId) return;
    if (!st.drafts.some((d) => d.draft_id === draftId)) return;
    set((s) => {
      const byDraft = { ...s.messagesByDraft };
      // cất conversation của draft đang xem trước khi chuyển
      if (s.activeDraftId) byDraft[s.activeDraftId] = s.messages;
      const next = byDraft[draftId] ?? [];
      return {
        activeDraftId: draftId,
        messages: next, // hiển thị lại lịch sử trò chuyện của lịch trình được chọn
        messagesByDraft: byDraft,
        pendingClarify: null,
        selectedActivityId: null,
        hoveredActivityId: null,
        activeTab: "timeline",
      };
    });
  },

  deleteDraft: (draftId) => {
    const draft = get().drafts.find((d) => d.draft_id === draftId);
    set((s) => {
      const newDrafts = s.drafts.filter((d) => d.draft_id !== draftId);
      const byDraft = { ...s.messagesByDraft };
      delete byDraft[draftId];
      // Xoá lịch trình đang xem → về trạng thái chưa chọn (không tự nhảy sang cái khác)
      const wasActive = s.activeDraftId === draftId;
      return {
        drafts: newDrafts,
        messagesByDraft: byDraft,
        activeDraftId: wasActive ? null : s.activeDraftId,
        messages: wasActive ? [] : s.messages,
      };
    });
    removeDraftFromBackend(draft?.itinerary.itinerary_id);
  },

  confirmDraft: (draftId) => {
    set((s) => ({
      drafts: s.drafts.map((d) =>
        d.draft_id === draftId
          ? { ...d, status: "confirmed", updated_at: nowIso() }
          : d
      ),
    }));
    const draft = get().drafts.find((d) => d.draft_id === draftId);
    if (!draft) return;
    persistDraftFromState(get(), draftId);
    emitToast({
      notification_id: `confirm-${Date.now()}`,
      user_id: "",
      itinerary_id: draft.itinerary.itinerary_id,
      activity_id: null,
      title: "Đã chốt lịch trình ✅",
      body: `"${draft.itinerary.title}" đã được lưu vào tài khoản của bạn.`,
      severity: "info",
      created_at: nowIso(),
      read: true,
    });
  },

  unconfirmDraft: (draftId) => {
    set((s) => ({
      drafts: s.drafts.map((d) =>
        d.draft_id === draftId
          ? { ...d, status: "draft", updated_at: nowIso() }
          : d
      ),
    }));
    const draft = get().drafts.find((d) => d.draft_id === draftId);
    if (!draft) return;
    persistDraftFromState(get(), draftId);
    emitToast({
      notification_id: `unconfirm-${Date.now()}`,
      user_id: "",
      itinerary_id: draft.itinerary.itinerary_id,
      activity_id: null,
      title: "Đã hủy chốt lịch trình",
      body: `"${draft.itinerary.title}" đã chuyển về trạng thái nháp.`,
      severity: "info",
      created_at: nowIso(),
      read: true,
    });
  },

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
