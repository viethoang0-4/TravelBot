/**
 * Sinh các Quick Action Chips dựa trên trạng thái hiện tại.
 *
 * Logic:
 * - Nếu chưa có itinerary → trả về câu hỏi mở (lập kế hoạch)
 * - Nếu đã có itinerary → trả về action thay đổi (thêm ngày, đổi khách sạn, …)
 */
import { Itinerary } from "@/types/travel";

export interface QuickAction {
  label: string;
  /** Nội dung sẽ được điền vào ô chat khi user bấm */
  prompt: string;
  /** Emoji icon (hiển thị bên trái label) */
  icon: string;
}

export function getQuickActions(itinerary: Itinerary | null): QuickAction[] {
  if (!itinerary) {
    return [
      {
        icon: "🏔️",
        label: "Đà Lạt 3N2Đ",
        prompt: "Lập kế hoạch du lịch Đà Lạt 3 ngày 2 đêm cho 2 người, ngân sách 5 triệu",
      },
      {
        icon: "🏖️",
        label: "Phú Quốc nghỉ dưỡng",
        prompt: "Lập kế hoạch nghỉ dưỡng Phú Quốc 4 ngày 3 đêm, ngân sách 10 triệu/người",
      },
      {
        icon: "🏛️",
        label: "Hội An cổ kính",
        prompt: "Gợi ý chuyến đi Hội An 2 ngày 1 đêm tập trung vào ẩm thực và phố cổ",
      },
      {
        icon: "💎",
        label: "Điểm ẩn",
        prompt: "Gợi ý 5 điểm du lịch ít người biết ở miền Bắc Việt Nam",
      },
    ];
  }

  // Đã có itinerary → action chỉnh sửa
  return [
    {
      icon: "➕",
      label: "Thêm 1 ngày nữa",
      prompt: `Thêm 1 ngày vào lịch trình ${itinerary.title}, gợi ý các hoạt động phù hợp với chủ đề chuyến đi`,
    },
    {
      icon: "💰",
      label: "Phương án rẻ hơn",
      prompt: `Tối ưu lại lịch trình ${itinerary.title} để tiết kiệm chi phí, gợi ý phương án rẻ hơn nhưng vẫn giữ trải nghiệm`,
    },
    {
      icon: "✨",
      label: "Khách sạn 5 sao",
      prompt: `Đổi tất cả chỗ ở trong lịch trình sang khách sạn/resort 5 sao, cập nhật lại ngân sách`,
    },
    {
      icon: "🍜",
      label: "Đổi chỗ ăn",
      prompt: `Chỉ thay đổi các hoạt động ăn uống (food) trong lịch trình, gợi ý quán đặc sản địa phương. Không thay đổi các hoạt động khác.`,
    },
    {
      icon: "🚗",
      label: "Tối ưu di chuyển",
      prompt: `Tối ưu lại lộ trình di chuyển trong lịch trình để giảm thời gian đi lại`,
    },
  ];
}

/**
 * Các bước hiển thị trên Skeleton screen — mô phỏng quá trình AI suy nghĩ.
 * Mỗi bước có icon, message và thời gian (ms) để chuyển sang bước tiếp theo.
 */
export interface PlanningStepConfig {
  key: string;
  icon: string;
  message: string;
  /** Delay tối thiểu trước khi chuyển sang bước tiếp (ms) */
  duration: number;
}

export const PLANNING_STEPS: PlanningStepConfig[] = [
  { key: "intent", icon: "🧠", message: "Đang phân tích yêu cầu của bạn...", duration: 800 },
  { key: "search_hotel", icon: "🏨", message: "Đang tìm kiếm khách sạn tốt nhất...", duration: 1500 },
  { key: "search_attraction", icon: "📍", message: "Đang tìm các điểm tham quan nổi bật...", duration: 1500 },
  { key: "optimize_route", icon: "🗺️", message: "Đang tối ưu lộ trình di chuyển...", duration: 1200 },
  { key: "calculate_budget", icon: "💰", message: "Đang tính toán ngân sách phù hợp...", duration: 1000 },
  { key: "finalize", icon: "✨", message: "Đang hoàn thiện lịch trình...", duration: 800 },
];
