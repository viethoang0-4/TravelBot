import type { Itinerary } from "@/types/travel";
import type { ChecklistItem } from "./checklist-defaults";

const MOUNTAIN_KEYWORDS = ["núi", "cao nguyên", "đèo", "đà lạt", "sapa", "măng đen", "mù cang", "hà giang", "tà xùa", "fansipan", "bắc hà", "cao bằng", "lạng sơn"];
const BEACH_KEYWORDS = ["biển", "bãi", "hòn", "đảo", "phú quốc", "nha trang", "đà nẵng", "hội an", "quy nhơn", "vũng tàu", "côn đảo", "lý sơn", "cù lao"];
const TEMPLE_KEYWORDS = ["chùa", "đền", "miếu", "thánh địa", "cố đô", "huế", "hội an phố cổ"];

function normalize(text: string): string {
  return text.toLowerCase();
}

function matchesAny(text: string, keywords: string[]): boolean {
  const lower = normalize(text);
  return keywords.some((kw) => lower.includes(kw));
}

export function suggestChecklistItems(itinerary: Itinerary): ChecklistItem[] {
  const suggestions: ChecklistItem[] = [];
  const dest = normalize(itinerary.destination);
  const allText = [
    itinerary.destination,
    itinerary.summary,
    ...itinerary.days.flatMap((d) => [d.theme, ...d.activities.flatMap((a) => [a.title, a.description, ...a.tags])]),
  ].join(" ");

  const isMountain = matchesAny(allText, MOUNTAIN_KEYWORDS);
  const isBeach = matchesAny(allText, BEACH_KEYWORDS);
  const hasTemple = matchesAny(allText, TEMPLE_KEYWORDS);
  const weatherSensitiveCount = itinerary.days
    .flatMap((d) => d.activities)
    .filter((a) => a.weather_sensitive).length;
  const hasHiddenGems = itinerary.days.flatMap((d) => d.activities).some((a) => a.is_hidden_gem);
  const hasExpensiveFood = itinerary.days.flatMap((d) => d.activities).some((a) => a.type === "food" && a.cost_estimate > 200000);

  if (isMountain) {
    suggestions.push(
      { id: "sug-warm-coat", label: "Áo ấm/phao lông (sáng sớm lạnh)", category: "👕 Quần áo", isCustom: true },
      { id: "sug-trekking-shoes", label: "Giày trekking đế bám", category: "👕 Quần áo", isCustom: true },
      { id: "sug-moisturizer", label: "Kem dưỡng ẩm tay/môi (khô hanh)", category: "🧴 Vệ sinh", isCustom: true }
    );
  }

  if (isBeach) {
    suggestions.push(
      { id: "sug-swimwear-extra", label: "Thêm đồ bơi 2 bộ (phơi nhanh)", category: "👕 Quần áo", isCustom: true },
      { id: "sug-flip-flops", label: "Dép xỏ ngón đi biển", category: "👕 Quần áo", isCustom: true },
      { id: "sug-spf70", label: "Kem chống nắng SPF 70+ (nước/chống thấm)", category: "🧴 Vệ sinh", isCustom: true },
      { id: "sug-rash-guard", label: "Áo bảo vệ UV khi bơi/lặn", category: "👕 Quần áo", isCustom: true }
    );
  }

  if (hasTemple) {
    suggestions.push(
      { id: "sug-modest-wear", label: "Quần/váy dài khi vào đền chùa", category: "👕 Quần áo", isCustom: true }
    );
  }

  if (weatherSensitiveCount >= 2) {
    suggestions.push(
      { id: "sug-raincoat", label: "Áo mưa mỏng gọn (dự phòng)", category: "👕 Quần áo", isCustom: true }
    );
  }

  if (hasExpensiveFood) {
    suggestions.push(
      { id: "sug-cash-vnd", label: "Tiền mặt VND đủ dùng", category: "📄 Giấy tờ", isCustom: true }
    );
  }

  if (hasHiddenGems) {
    suggestions.push(
      { id: "sug-offline-map", label: "Tải bản đồ offline (Maps.me/Google offline)", category: "📱 Thiết bị", isCustom: true }
    );
  }

  // Luôn gợi ý túi tote/bag nhỏ cho chuyến đi ngắn
  if (dest && !dest.includes("hà nội") && !dest.includes("hồ chí minh")) {
    suggestions.push(
      { id: "sug-day-bag", label: "Balo/túi tote nhỏ đi ngày", category: "👕 Quần áo", isCustom: true }
    );
  }

  return suggestions;
}
