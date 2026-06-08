import { Activity } from "@/types/travel";

/**
 * Xác định một activity là "sự kiện cố định" — KHÔNG thể kéo-thả / đổi chỗ.
 *
 * Quy tắc:
 *  - type = "transport"      → chuyến bay/xe, gồm xuất phát & kết thúc
 *  - type = "accommodation"  → check-in / check-out khách sạn
 *  - tôn trọng cờ `is_locked` nếu dữ liệu đã set sẵn (vd: mock, hoặc backend sau này)
 *
 * Dùng chung cho ActivityCard (disable kéo + icon khoá) và ItineraryTimeline
 * (chặn ô khác đẩy ô cố định khỏi vị trí) để hai nơi luôn nhất quán.
 */
export function isActivityLocked(activity: Activity): boolean {
  return (
    activity.is_locked === true ||
    activity.type === "transport" ||
    activity.type === "accommodation"
  );
}
