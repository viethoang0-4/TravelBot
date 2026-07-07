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
  /** Sự kiện cố định (chuyến bay, check-in/out...) — không cho phép drag-drop */
  is_locked?: boolean;
}

/** Một chặng di chuyển THẬT giữa 2 hoạt động (Goong Directions). */
export interface RouteLeg {
  from_id: string;
  to_id: string;
  distance_m: number;
  duration_s: number;
}

/**
 * Tuyến đường THẬT của một ngày, do grounding node (Goong) gắn vào sau planner.
 * `seq` = thứ tự id hoạt động tuyến đường này bám theo → FE so với thứ tự hiện tại
 * để phát hiện người dùng đã kéo-thả đổi chỗ (stale) và fallback vẽ đường thẳng.
 */
export interface DayRoute {
  polyline: string; // encoded polyline (precision 5)
  seq: string[];
  legs: RouteLeg[];
}

export interface DayPlan {
  day: number;
  date: string;
  theme: string;
  activities: Activity[];
  /** Tuyến đường thật trong ngày (có khi backend bật grounding Goong); không có → vẽ đường thẳng. */
  route?: DayRoute;
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

/** Một phương thức di chuyển trong tính carbon (để so sánh ô tô vs xe máy). */
export interface CarbonMode {
  label: string;
  factor: number;
  local_kg: number;
}

/** Chặng liên tỉnh (origin↔destination, khứ hồi). */
export interface CarbonIntercity {
  mode: string;
  label: string;
  factor: number;
  distance_km: number;
  passengers: number;
  kg: number;
}

/**
 * Dấu chân carbon của hành trình. Nội vùng tính từ quãng đường THẬT (Goong Directions);
 * liên tỉnh ước tính khứ hồi origin↔destination. Hệ số: UK DEFRA 2023 / IPCC / ICAO.
 */
export interface TripCarbon {
  vehicle: string;
  vehicle_label: string;
  local_km: number;
  local_kg: number;
  modes: { car: CarbonMode; motorbike: CarbonMode };
  by_day: { day: number; km: number; kg: number }[];
  intercity: CarbonIntercity | null;
  total_kg: number;
  source: string;
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
  /** Dấu chân carbon (chỉ có khi backend bật grounding Goong). */
  carbon?: TripCarbon;
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

/**
 * Mốc hoàn thiện của lịch trình khi stream (progressive rendering):
 *  - drafting:  vừa xong planner (tọa độ tạm, chưa có tuyến/thời tiết)
 *  - enriching: đã neo tọa độ + tuyến Goong + cờ thời tiết (sau grounding/weather)
 *  - ready:     bản cuối đã qua critic + lưu DB → mở khoá sửa/chốt
 */
export type PlanStage = "drafting" | "enriching" | "ready";

export type StreamEvent =
  | { type: "thinking"; content: string }
  | { type: "searching"; content: string }
  | { type: "text"; content: string }
  | { type: "itinerary"; content: Itinerary; stage?: PlanStage }
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
