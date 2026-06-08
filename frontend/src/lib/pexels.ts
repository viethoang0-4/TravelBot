// Lấy ảnh từ Pexels (free, key tức thì, không thẻ) — có XÁC THỰC địa điểm + phân tầng.
//
// Vấn đề: Pexels search theo từ khoá, KHÔNG theo toạ độ → địa danh nhỏ (vd "Bình Liêu")
// dễ ra ảnh sai (vd "Bình Long"). Cách xử lý:
//   Tầng 0: nếu Planner LLM đã sinh `image_query` (vd "Ha Long Bay cruise") → tin & dùng luôn.
//   Tầng 1: tìm theo tên địa điểm, CHỈ nhận nếu mô tả/URL ảnh thật sự chứa tên đó.
//   Tầng 2: nếu không → tìm theo "loại hoạt động + vùng (điểm đến)".
//   Tầng 3: nếu vẫn không → tìm theo loại chung.
//   Hết → null → placeholder.
// Có cache 2 tầng (memory + localStorage) + gộp request trùng để né rate-limit.

import { ActivityType } from "@/types/travel";

const PEXELS_KEY = process.env.NEXT_PUBLIC_PEXELS_API_KEY ?? "";
const LS_PREFIX = "tb_img2:";
const PER_PAGE = 12; // lấy nhiều để các card cùng loại không trùng 1 ảnh

interface Photo {
  url: string;
  matchText: string; // alt + page url, dùng để xác thực địa điểm
}

const memCache = new Map<string, Photo[]>();
const inflight = new Map<string, Promise<Photo[]>>();

export function hasPexels(): boolean {
  return !!PEXELS_KEY;
}

export function isUsableImageUrl(url?: string | null): url is string {
  return !!url && /^https?:\/\//.test(url);
}

/** Bỏ dấu tiếng Việt + chuẩn hoá để so khớp/đặt query */
function deburr(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Ảnh có đúng địa điểm không: mô tả/URL ảnh (bỏ dấu, bỏ cách) chứa tên địa điểm */
function placeMatches(matchText: string, place: string): boolean {
  const needle = deburr(place).replace(/\s+/g, "");
  if (needle.length < 3) return false;
  const hay = deburr(matchText).replace(/\s+/g, "");
  return hay.includes(needle);
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pick(photos: Photo[], seed: string): string | null {
  if (photos.length === 0) return null;
  return photos[hashCode(seed) % photos.length].url;
}

function readLS(key: string): Photo[] | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const v = localStorage.getItem(LS_PREFIX + key);
    return v === null ? undefined : (JSON.parse(v) as Photo[]);
  } catch {
    return undefined;
  }
}

function writeLS(key: string, photos: Photo[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(photos));
  } catch {
    /* localStorage đầy/bị chặn — bỏ qua */
  }
}

async function searchPexels(query: string): Promise<Photo[]> {
  const key = query.trim().toLowerCase();
  if (!key || !PEXELS_KEY) return [];

  if (memCache.has(key)) return memCache.get(key)!;
  const cached = readLS(key);
  if (cached !== undefined) {
    memCache.set(key, cached);
    return cached;
  }
  const pending = inflight.get(key);
  if (pending) return pending;

  const p = (async () => {
    try {
      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(
          query
        )}&per_page=${PER_PAGE}&orientation=landscape`,
        { headers: { Authorization: PEXELS_KEY } }
      );
      if (!res.ok) return [];
      const data = await res.json();
      const photos: Photo[] = (data?.photos ?? [])
        .map((ph: Record<string, any>) => ({
          url: ph?.src?.landscape ?? ph?.src?.medium ?? "",
          matchText: `${ph?.alt ?? ""} ${ph?.url ?? ""}`,
        }))
        .filter((ph: Photo) => !!ph.url);
      memCache.set(key, photos);
      writeLS(key, photos);
      return photos;
    } catch {
      return [];
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

const CATEGORY_WORD: Record<ActivityType, string> = {
  food: "Vietnamese food",
  accommodation: "Vietnam hotel resort",
  transport: "Vietnam travel road trip",
  shopping: "Vietnam market street",
  rest: "Vietnam cafe coffee",
  activity: "Vietnam landscape travel",
};

/**
 * Giải ảnh cho 1 hoạt động theo các tầng + xác thực địa điểm.
 * `imageQuery` (do Planner LLM sinh) nếu có sẽ được tin dùng trước tiên.
 * `seed` (vd activity.id) để các card cùng query không trùng 1 ảnh.
 */
export async function resolveActivityImage(
  place: string,
  region: string,
  type: ActivityType,
  seed: string,
  imageQuery?: string | null
): Promise<string | null> {
  if (!PEXELS_KEY) return null;
  const cat = CATEGORY_WORD[type] ?? CATEGORY_WORD.activity;

  // Tầng 0: cụm từ ảnh do LLM sinh — đã được tối ưu cho stock photo, tin dùng luôn (không cần xác thực)
  const q = deburr(imageQuery ?? "");
  if (q.length >= 3) {
    const url = pick(await searchPexels(q), seed);
    if (url) return url;
  }

  // Tầng 1: theo tên địa điểm — chỉ nhận khi ảnh ĐÚNG địa điểm
  const placeAscii = deburr(place);
  if (placeAscii.length >= 3) {
    const photos = await searchPexels(`${placeAscii} Vietnam`);
    const top = photos[0];
    if (top && placeMatches(top.matchText, place)) return top.url;
  }

  // Tầng 2: theo loại + vùng (điểm đến)
  const regionAscii = deburr(region);
  if (regionAscii.length >= 2) {
    const photos = await searchPexels(`${regionAscii} ${cat}`);
    const url = pick(photos, seed);
    if (url) return url;
  }

  // Tầng 3: theo loại chung
  const url = pick(await searchPexels(cat), seed);
  return url;
}
