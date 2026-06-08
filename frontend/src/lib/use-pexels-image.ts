"use client";

import { useEffect, useState } from "react";
import { ActivityType } from "@/types/travel";
import { hasPexels, isUsableImageUrl, resolveActivityImage } from "./pexels";

/**
 * Trả URL ảnh đã giải theo các tầng (image_query LLM → tên địa điểm có xác thực → loại+vùng → loại chung).
 *  - `realUrl`: nếu đã có ảnh thật hợp lệ thì dùng luôn, không gọi Pexels.
 *  - `imageQuery`: cụm từ tìm ảnh do Planner LLM sinh — ưu tiên dùng trước.
 *  - trả null → UI dùng placeholder.
 */
export function useResolvedImage(
  place: string | null,
  region: string,
  type: ActivityType,
  seed: string,
  realUrl?: string | null,
  imageQuery?: string | null
): string | null {
  const usable = isUsableImageUrl(realUrl) ? realUrl : null;
  const [src, setSrc] = useState<string | null>(usable);

  useEffect(() => {
    if (usable) {
      setSrc(usable);
      return;
    }
    if ((!place && !imageQuery) || !hasPexels()) {
      setSrc(null);
      return;
    }
    let alive = true;
    resolveActivityImage(place ?? "", region, type, seed, imageQuery).then((url) => {
      if (alive) setSrc(url);
    });
    return () => {
      alive = false;
    };
  }, [usable, place, region, type, seed, imageQuery]);

  return src;
}
