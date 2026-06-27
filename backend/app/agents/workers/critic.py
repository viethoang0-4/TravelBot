"""Critic agent — hybrid: deterministic signals + LLM verdict (reflection loop)."""
import json
import math

from langchain_core.messages import SystemMessage, HumanMessage

from ..prompts import CRITIC_PROMPT
from ..schemas import CriticVerdict
from ..state import TravelAgentState
from .common import brief_itinerary, structured_invoke

_AVG_CITY_SPEED_KMH = 30.0  # rough urban travel speed for feasibility check


def _haversine_km(lat1, lng1, lat2, lng2) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def _minutes(t: str) -> int:
    return int(t[:2]) * 60 + int(t[3:5])


def _signals(draft: dict, weather_summary: list[dict] | None) -> dict:
    signals: dict = {"weather_conflicts": [], "tight_transitions": [], "budget": {}}

    for s in weather_summary or []:
        if s.get("severe"):
            signals["weather_conflicts"].append(
                f"{s.get('title')} ({s.get('time')} {s.get('day')}): {s.get('condition')}"
            )

    for day in draft.get("days", []):
        acts = day.get("activities", [])
        # Chặng đường THẬT từ Goong (grounding node) — ưu tiên dùng thay haversine.
        real_legs = {
            (leg.get("from_id"), leg.get("to_id")): leg
            for leg in ((day.get("route") or {}).get("legs") or [])
        }
        for i in range(len(acts) - 1):
            a, b = acts[i], acts[i + 1]
            la, lo = a.get("location", {}).get("lat"), a.get("location", {}).get("lng")
            lb, lob = b.get("location", {}).get("lat"), b.get("location", {}).get("lng")
            if None in (la, lo, lb, lob):
                continue
            try:
                gap = _minutes(b.get("time", "00:00")) - _minutes(a.get("time", "00:00")) - a.get("duration_minutes", 0)
            except (ValueError, IndexError):
                continue
            leg = real_legs.get((a.get("id"), b.get("id")))
            if leg:  # khoảng cách & thời gian di chuyển THẬT (Goong Directions)
                dist = leg.get("distance_m", 0) / 1000
                travel_min = leg.get("duration_s", 0) / 60
                src = "đường thật"
            else:    # fallback: đường chim bay × tốc độ đô thị ước lượng
                dist = _haversine_km(la, lo, lb, lob)
                travel_min = dist / _AVG_CITY_SPEED_KMH * 60
                src = "ước lượng"
            if travel_min > max(gap, 0) + 15:  # no buffer to get there
                signals["tight_transitions"].append(
                    f"{a.get('title')} → {b.get('title')}: ~{dist:.1f}km (~{travel_min:.0f}p di chuyển, {src}) "
                    f"nhưng chỉ có {gap}p trống"
                )

    total_acts = sum(
        a.get("cost_estimate", 0)
        for day in draft.get("days", [])
        for a in day.get("activities", [])
    )
    declared = draft.get("budget", {}).get("total_estimated", 0)
    signals["budget"] = {"sum_activities": total_acts, "declared_total": declared}
    return signals


async def critic_node(state: TravelAgentState) -> dict:
    draft = state.get("draft_itinerary")
    if not draft:
        return {"critic_verdict": "approved", "critic_feedback": None}

    signals = _signals(draft, state.get("weather_summary"))
    ctx = (
        "Tín hiệu đã tính sẵn (dùng để đánh giá):\n"
        + json.dumps(signals, ensure_ascii=False, indent=2)
        + "\n\nTóm tắt lịch trình:\n"
        + brief_itinerary(draft)
    )

    verdict = await structured_invoke(
        "critic", CriticVerdict,
        [SystemMessage(content=CRITIC_PROMPT), HumanMessage(content=ctx)],
    )
    if verdict is None:
        print("[CRITIC] no verdict, approving")
        return {"critic_verdict": "approved", "critic_feedback": None}

    feedback = None
    if verdict.verdict == "revise":
        issues = "\n".join(f"- {i}" for i in verdict.issues) or "- (không nêu chi tiết)"
        sugg = "\n".join(f"- {s}" for s in verdict.suggestions) or "- (không có)"
        feedback = f"Vấn đề:\n{issues}\n\nGợi ý sửa:\n{sugg}"

    print(f"[CRITIC] verdict={verdict.verdict} | issues={len(verdict.issues)}")
    return {"critic_verdict": verdict.verdict, "critic_feedback": feedback}
