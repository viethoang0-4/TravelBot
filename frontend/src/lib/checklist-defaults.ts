export interface ChecklistItem {
  id: string;
  label: string;
  category: string;
  isCustom?: boolean;
}

export const DEFAULT_CHECKLIST: ChecklistItem[] = [
  // Giấy tờ
  { id: "id-card", label: "CMND/CCCD/Hộ chiếu", category: "📄 Giấy tờ" },
  { id: "booking", label: "Mã đặt vé/khách sạn", category: "📄 Giấy tờ" },
  { id: "insurance", label: "Bảo hiểm du lịch", category: "📄 Giấy tờ" },

  // Quần áo
  { id: "casual-clothes", label: "Quần áo thường ngày", category: "👕 Quần áo" },
  { id: "warm-jacket", label: "Áo khoác (nếu vùng lạnh)", category: "👕 Quần áo" },
  { id: "swimwear", label: "Đồ bơi (nếu biển/hồ)", category: "👕 Quần áo" },
  { id: "shoes", label: "Giày thể thao + dép", category: "👕 Quần áo" },

  // Đồ vệ sinh
  { id: "toiletries", label: "Đồ vệ sinh cá nhân", category: "🧴 Vệ sinh" },
  { id: "sunscreen", label: "Kem chống nắng SPF 50+", category: "🧴 Vệ sinh" },
  { id: "skincare", label: "Sữa rửa mặt, dưỡng ẩm", category: "🧴 Vệ sinh" },

  // Thuốc
  { id: "med-cold", label: "Thuốc cảm cúm cơ bản", category: "💊 Y tế" },
  { id: "med-bandaid", label: "Băng cá nhân, oxy già", category: "💊 Y tế" },
  { id: "med-motion", label: "Thuốc say xe (nếu cần)", category: "💊 Y tế" },

  // Thiết bị
  { id: "phone-charger", label: "Sạc điện thoại + cáp", category: "📱 Thiết bị" },
  { id: "powerbank", label: "Sạc dự phòng", category: "📱 Thiết bị" },
  { id: "camera", label: "Máy ảnh + thẻ nhớ", category: "📱 Thiết bị" },
  { id: "headphones", label: "Tai nghe", category: "📱 Thiết bị" },
];

export const DEFAULT_CATEGORIES = [
  "📄 Giấy tờ",
  "👕 Quần áo",
  "🧴 Vệ sinh",
  "💊 Y tế",
  "📱 Thiết bị",
];

export const CULTURAL_NOTES = [
  "🙏 Khi vào chùa/đền: ăn mặc kín đáo, không ồn ào",
  "💵 Chuẩn bị tiền mặt VND — nhiều nơi ở vùng quê chưa nhận thẻ",
  "📸 Hỏi ý kiến trước khi chụp ảnh người lạ",
  "🍜 Thử món địa phương — đặc sản thường ở quán nhỏ ven đường",
  "💰 Trả giá nhẹ nhàng ở chợ — đừng quá gắt",
];
