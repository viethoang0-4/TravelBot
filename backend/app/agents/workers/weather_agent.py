"""Weather node (deterministic) — annotates the draft with forecast & severity.

Reuses services/weather.py. Sets weather_sensitive on outdoor activities that fall
in a severe slot, and builds a weather_summary the critic & planner reason over.
"""
import asyncio
from datetime import datetime, timezone

from ..state import TravelAgentState
from ...services import weather as weather_svc

# Số call dự báo thời tiết đồng thời tối đa (song song hóa nhưng chặn burst API).
_WEATHER_CONCURRENCY = 6


async def weather_node(state: TravelAgentState) -> dict:
    draft = state.get("draft_itinerary")
    if not draft:
        return {"weather_summary": []}

    # Gom tọa độ DUY NHẤT (làm tròn 3 chữ số) rồi lấy dự báo SONG SONG (bounded) thay vì
    # gọi tuần tự từng điểm.
    coords: dict[str, tuple[float, float]] = {}
    for day in draft.get("days", []):
        for a in day.get("activities", []):
            loc = a.get("location", {})
            lat, lng = loc.get("lat"), loc.get("lng")
            if not lat or not lng:
                continue
            coords.setdefault(f"{round(lat, 3)},{round(lng, 3)}", (lat, lng))

    sem = asyncio.Semaphore(_WEATHER_CONCURRENCY)

    async def _fc(lat: float, lng: float):
        async with sem:
            return await weather_svc.get_forecast(lat, lng)

    keys = list(coords.keys())
    forecasts = await asyncio.gather(*[_fc(*coords[k]) for k in keys])
    coord_cache: dict[str, dict | None] = dict(zip(keys, forecasts))

    summary: list[dict] = []
    for day in draft.get("days", []):
        date_str = day.get("date", "")
        try:
            d = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            continue

        for a in day.get("activities", []):
            loc = a.get("location", {})
            lat, lng = loc.get("lat"), loc.get("lng")
            if not lat or not lng:
                continue

            key = f"{round(lat, 3)},{round(lng, 3)}"
            forecast = coord_cache.get(key)
            if not forecast:
                continue

            t = a.get("time", "08:00")
            try:
                adt = datetime(d.year, d.month, d.day, int(t[:2]), int(t[3:5]), tzinfo=timezone.utc)
            except (ValueError, IndexError):
                continue

            slot = weather_svc.get_forecast_for_datetime(forecast, adt)
            if not slot:
                continue

            weather_id = slot.get("weather", [{}])[0].get("id", 800)
            desc = slot.get("weather", [{}])[0].get("description", "")
            wind = slot.get("wind", {}).get("speed", 0)
            severe, cond = weather_svc.is_severe(weather_id, wind)

            is_outdoor = a.get("type") in ("activity", "transport")
            if severe and (a.get("weather_sensitive") or is_outdoor):
                a["weather_sensitive"] = True

            summary.append({
                "day": date_str,
                "activity_id": a.get("id"),
                "title": a.get("title"),
                "time": t,
                "condition": desc,
                "severe": severe,
                "cond_type": cond,
            })

    n_severe = sum(1 for s in summary if s["severe"])
    print(f"[WEATHER] checked {len(summary)} slots, {n_severe} severe")
    return {"weather_summary": summary, "draft_itinerary": draft}
