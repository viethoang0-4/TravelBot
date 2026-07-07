"""
Grounding node — neo lịch trình vào dữ liệu địa lý THẬT của Goong (chống ảo giác).

Chạy SAU planner, TRƯỚC weather (để thời tiết & critic dùng tọa độ thật):

1. Geocode mỗi địa điểm: thay lat/lng do LLM "đoán" bằng tọa độ thật + địa chỉ +
   place_id của Goong.
2. Directions theo từng ngày: tính tuyến đường thật (polyline) + khoảng cách/thời gian
   di chuyển thật từng chặng. Gắn vào `day["route"]`:
       {
         "polyline": "<encoded overview polyline>",   # bản đồ vẽ đường thật
         "seq": ["act-..","act-.."],                   # thứ tự id để FE phát hiện reorder
         "legs": [{"from_id","to_id","distance_m","duration_s"}, ...],  # critic dùng
       }
   `route` được gắn thẳng vào dict lịch trình (KHÔNG nằm trong schema Itinerary của
   planner — tránh làm phình output có cấu trúc của planner; DB lưu JSONB nên giữ nguyên).

Degrade an toàn: thiếu GOONG_API_KEY / grounding_enabled=false / lỗi mạng → giữ nguyên
draft, không gắn route (bản đồ tự fallback vẽ đường thẳng).
"""
import asyncio

from ..state import TravelAgentState
from ...config import get_settings
from ...services import goong, carbon

# Số call Goong đồng thời tối đa — song song hóa nhưng chặn burst vượt QPS free tier.
_GOONG_CONCURRENCY = 6


def _valid(loc: dict) -> bool:
    lat, lng = loc.get("lat"), loc.get("lng")
    return (
        isinstance(lat, (int, float))
        and isinstance(lng, (int, float))
        and not (lat == 0 and lng == 0)
    )


async def _intercity_km(origin: str, destination: str) -> float | None:
    """Cự ly đường chim bay origin↔destination (1 chiều) để ước tính chặng liên tỉnh."""
    origin = (origin or "").strip()
    destination = (destination or "").strip()
    if not origin or not destination or origin.lower() == destination.lower():
        return None
    go, gd = await asyncio.gather(goong.geocode(origin), goong.geocode(destination))
    if not go or not gd:
        return None
    return carbon.haversine_km((go["lat"], go["lng"]), (gd["lat"], gd["lng"]))


async def grounding_node(state: TravelAgentState) -> dict:
    settings = get_settings()
    draft = state.get("draft_itinerary")
    if not draft or not settings.grounding_enabled or not settings.goong_api_key:
        return {}

    destination = draft.get("destination", "") or ""
    sem = asyncio.Semaphore(_GOONG_CONCURRENCY)

    async def _geo(query: str):
        async with sem:
            return await goong.geocode(query)

    # 1. Geocode từng địa điểm — SONG SONG (bounded). Service tự cache theo query.
    geo_targets: list[tuple[dict, str]] = []
    for day in draft.get("days", []):
        for a in day.get("activities", []):
            loc = a.get("location") or {}
            name = (loc.get("name") or a.get("title") or "").strip()
            if not name:
                continue
            query = f"{name}, {destination}" if destination else name
            geo_targets.append((a, query))

    geos = await asyncio.gather(*[_geo(q) for _, q in geo_targets])
    grounded = 0
    for (a, _), geo in zip(geo_targets, geos):
        if not geo:
            continue
        loc = a.get("location") or {}
        loc["lat"], loc["lng"] = geo["lat"], geo["lng"]
        if geo["address"]:
            loc["address"] = geo["address"]
        if geo["place_id"]:
            loc["place_id"] = geo["place_id"]
        a["location"] = loc
        grounded += 1

    # 2. Bỏ điểm ĐẦU & CUỐI toàn hành trình khỏi việc vẽ tuyến (thường là điểm xuất phát /
    #    quay về — không cần thiết trong chuyến đi). Marker vẫn hiển thị, chỉ không nối đường.
    flat = [
        a
        for day in draft.get("days", [])
        for a in day.get("activities", [])
        if _valid(a.get("location") or {})
    ]
    skip_ids = {flat[0].get("id"), flat[-1].get("id")} if flat else set()

    # 3. Directions theo từng ngày (giữ thứ tự) — SONG SONG (mỗi ngày 1 call).
    day_specs: list[tuple[dict, list[dict]]] = []
    for day in draft.get("days", []):
        acts = [
            a
            for a in day.get("activities", [])
            if _valid(a.get("location") or {}) and a.get("id") not in skip_ids
        ]
        if len(acts) < 2:
            day.pop("route", None)
            continue
        day_specs.append((day, acts))

    async def _dir(points: list[tuple[float, float]]):
        async with sem:
            return await goong.directions(points, vehicle=settings.grounding_vehicle)

    routes = await asyncio.gather(*[
        _dir([(a["location"]["lat"], a["location"]["lng"]) for a in acts])
        for _, acts in day_specs
    ])

    routed = 0
    total_m = 0
    by_day: list[dict] = []
    for (day, acts), route in zip(day_specs, routes):
        if not route:
            day.pop("route", None)
            continue
        ids = [a["id"] for a in acts]
        legs = [
            {"from_id": ids[i], "to_id": ids[i + 1], **leg}
            for i, leg in enumerate(route["legs"])
            if i + 1 < len(ids)
        ]
        day["route"] = {"polyline": route["polyline"], "seq": ids, "legs": legs}
        day_m = sum(leg["distance_m"] for leg in legs)
        total_m += day_m
        by_day.append({"day": day.get("day"), "km": round(day_m / 1000, 1)})
        routed += 1

    # 4. Dấu chân carbon: nội vùng (quãng đường THẬT) + liên tỉnh (origin↔destination khứ hồi).
    slots = state.get("slots") or {}
    intercity_km = await _intercity_km(slots.get("origin", ""), destination)
    passengers = int(slots.get("party_size") or 1)
    c = carbon.compute(total_m, by_day, settings.grounding_vehicle, intercity_km, passengers)
    if c:
        draft["carbon"] = c
    else:
        draft.pop("carbon", None)

    total_kg = (draft.get("carbon") or {}).get("total_kg")
    print(
        f"[GROUNDING] geocoded {grounded} POIs, routed {routed} days, "
        f"{total_m / 1000:.1f}km nội vùng, intercity={intercity_km and round(intercity_km)}km, "
        f"carbon_total={total_kg}kg (Goong)"
    )
    return {"draft_itinerary": draft}
