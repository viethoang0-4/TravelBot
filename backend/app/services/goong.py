"""
Goong Maps REST client — neo lịch trình vào dữ liệu địa lý THẬT (chống ảo giác).

Hai chức năng:
1. geocode()    — forward geocoding: tên/địa chỉ → tọa độ thật + place_id + địa chỉ chuẩn.
2. directions() — định tuyến qua nhiều điểm (giữ thứ tự) → polyline tuyến đường thật +
                  khoảng cách/thời gian di chuyển thật từng chặng (thay haversine).

Goong là nhà cung cấp bản đồ Việt Nam (thể hiện đúng chủ quyền Hoàng Sa/Trường Sa).
Mọi lỗi (thiếu key, lỗi mạng) → trả None: pipeline lập kế hoạch KHÔNG BAO GIỜ vỡ.
"""
import time

import httpx

from ..config import get_settings

_GEOCODE_URL = "https://rsapi.goong.io/geocode"
_DIRECTION_URL = "https://rsapi.goong.io/Direction"

# Cache tọa độ theo query (POI gần như bất biến) — tránh gọi lại trùng giữa các vòng
# reflection và giữa các request cho cùng địa điểm phổ biến.
_geo_cache: dict[str, tuple[float, dict | None]] = {}
_GEO_TTL = 24 * 3600  # 24h


async def geocode(query: str) -> dict | None:
    """Forward geocode → {'lat','lng','address','place_id'} hoặc None."""
    settings = get_settings()
    query = (query or "").strip()
    if not settings.goong_api_key or not query:
        return None

    now = time.time()
    hit = _geo_cache.get(query)
    if hit and now - hit[0] < _GEO_TTL:
        return hit[1]

    result: dict | None = None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                _GEOCODE_URL,
                params={"address": query, "api_key": settings.goong_api_key},
            )
            resp.raise_for_status()
            results = resp.json().get("results", [])
        if results:
            top = results[0]
            loc = (top.get("geometry") or {}).get("location") or {}
            lat, lng = loc.get("lat"), loc.get("lng")
            if lat is not None and lng is not None:
                result = {
                    "lat": float(lat),
                    "lng": float(lng),
                    "address": top.get("formatted_address", "") or "",
                    "place_id": top.get("place_id", "") or "",
                }
    except Exception as exc:
        print(f"[GOONG] geocode lỗi '{query}': {exc}")
        result = None

    _geo_cache[query] = (now, result)
    return result


async def directions(
    points: list[tuple[float, float]], vehicle: str = "car"
) -> dict | None:
    """Tuyến đường qua các điểm (lat,lng) theo đúng thứ tự.

    Trả {'polyline': <encoded>, 'legs': [{'distance_m','duration_s'}, ...]} hoặc None.
    Dùng Goong Direction với waypoints (1 call cho cả ngày). Cần >= 2 điểm.
    legs[i] = chặng từ points[i] -> points[i+1].
    """
    settings = get_settings()
    if not settings.goong_api_key or len(points) < 2:
        return None

    params = {
        "origin": f"{points[0][0]},{points[0][1]}",
        "destination": f"{points[-1][0]},{points[-1][1]}",
        "vehicle": vehicle,
        "api_key": settings.goong_api_key,
    }
    if len(points) > 2:
        params["waypoints"] = ";".join(f"{lat},{lng}" for lat, lng in points[1:-1])

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.get(_DIRECTION_URL, params=params)
            resp.raise_for_status()
            routes = resp.json().get("routes", [])
        if not routes:
            return None
        r0 = routes[0]
        poly = (r0.get("overview_polyline") or {}).get("points", "") or ""
        if not poly:
            return None
        legs = [
            {
                "distance_m": int((leg.get("distance") or {}).get("value", 0) or 0),
                "duration_s": int((leg.get("duration") or {}).get("value", 0) or 0),
            }
            for leg in r0.get("legs", [])
        ]
        return {"polyline": poly, "legs": legs}
    except Exception as exc:
        print(f"[GOONG] directions lỗi: {exc}")
        return None
