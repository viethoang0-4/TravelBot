export interface Location {
  name: string;
  address?: string;
  lat: number;
  lng: number;
  place_id?: string;
}

/**
 * Loại hoạt động — phân biệt nhóm để khi user yêu cầu thay đổi 1 nhóm
 * (vd: "đổi chỗ ăn") thì chỉ những activity có cùng category bị regenerate.
 */
export type ActivityType =
  | "transport"
  | "accommodation"
  | "food"
  | "activity"
  | "shopping"
  | "rest";

/**
 * Phân loại "macro" để chia theo chủ đề (food / fun / relax / travel / stay).
 * Mapping ActivityType → ActivityCategory:
 *   food          → "food"
 *   activity      → "fun"   (tham quan, vui chơi)
 *   shopping      → "fun"
 *   rest          → "relax"
 *   transport     → "travel"
 *   accommodation → "stay"
 */
export type ActivityCategory = "food" | "fun" | "relax" | "travel" | "stay";

export interface Activity {
  id: string;
  time: string;
  duration_minutes: number;
  type: ActivityType;
  title: string;
  description: string;
  location: Location;
  cost_estimate: number;
  tips?: string;
  booking_url?: string | null;
  is_hidden_gem: boolean;
  weather_sensitive: boolean;
  tags: string[];
  image_url?: string;
  /** Cụm từ tìm ảnh do Planner LLM sinh (vd "Ha Long Bay cruise") — ưu tiên dùng để search Pexels */
  image_query?: string;
  /** Đánh giá 0..5 sao (tuỳ chọn) */
  rating?: number;
  /** Sự kiện cố định (chuyến bay, check-in/out...) — không cho phép drag-drop */
  is_locked?: boolean;
}

export interface DayPlan {
  day: number;
  date: string;
  theme: string;
  activities: Activity[];
}

export interface BudgetBreakdown {
  accommodation: number;
  transport: number;
  food: number;
  activities: number;
  misc: number;
}

export interface Budget {
  total_estimated: number;
  currency: string;
  breakdown: BudgetBreakdown;
}

export interface HiddenGem {
  id: string;
  name: string;
  description: string;
  location: Location;
  source: string;
  confidence_score: number;
}

export interface Itinerary {
  itinerary_id: string;
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
  summary: string;
  budget: Budget;
  days: DayPlan[];
  hidden_gems: HiddenGem[];
  meta: {
    generated_by: string;
    model_used: string;
    generated_at: string;
    version: number;
  };
}

/** Trạng thái của bản nháp lịch trình */
export type DraftStatus = "draft" | "confirmed";

/**
 * Một bản nháp = một Itinerary + metadata quản lý (status, ngày tạo, etc.)
 * Drafts được lưu trong store, người dùng có thể chuyển qua lại mà không
 * mất lịch sử chat (chat history được lưu chung — drafts là độc lập).
 */
export interface ItineraryDraft {
  draft_id: string;
  itinerary: Itinerary;
  status: DraftStatus;
  created_at: string; // ISO
  updated_at: string; // ISO
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  itinerary?: Itinerary;
  image?: string; // base64
}

export type RightPanelTab = "timeline" | "map" | "budget" | "checklist";

/** Một câu hỏi làm rõ do clarify agent sinh (mỗi câu cho 1 trường còn thiếu) */
export interface ClarifyQuestion {
  field: string;
  question: string;
  options: string[];
}

export interface ClarifyPayload {
  intro: string;
  questions: ClarifyQuestion[];
}

export type StreamEvent =
  | { type: "thinking"; content: string }
  | { type: "searching"; content: string }
  | { type: "text"; content: string }
  | { type: "itinerary"; content: Itinerary }
  | { type: "questions"; content: ClarifyPayload }
  | { type: "error"; content: string }
  | { type: "done" };

/** Mapping Activity.type → ActivityCategory cho việc lọc/regenerate */
export function getActivityCategory(type: ActivityType): ActivityCategory {
  switch (type) {
    case "food":
      return "food";
    case "activity":
    case "shopping":
      return "fun";
    case "rest":
      return "relax";
    case "transport":
      return "travel";
    case "accommodation":
      return "stay";
  }
}
