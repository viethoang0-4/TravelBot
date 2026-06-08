"""Planner agent — builds (or revises) the itinerary as structured output."""
import json
import uuid
from datetime import datetime, timezone

from langchain_core.messages import SystemMessage, HumanMessage

from ..prompts import PLANNER_PROMPT
from ..state import TravelAgentState
from .common import last_user_text, structured_invoke
from ...config import get_settings
from ...models.itinerary import Itinerary


def _format_search(search_results: list[dict] | None) -> str:
    if not search_results:
        return ""
    by_label: dict[str, list[dict]] = {}
    for r in search_results:
        by_label.setdefault(r.get("label", "general"), []).append(r)

    headings = {
        "events": "[SỰ KIỆN / LỄ HỘI] đưa vào activity với tên thật, tag 'event'",
        "hidden_gems": "[HIDDEN GEMS] dùng cho hidden_gems, source = URL",
        "prices": "[GIÁ CẢ THỰC TẾ] dùng cho cost_estimate",
        "general": "[THÔNG TIN KHÁC]",
    }
    out = ["## DỮ LIỆU REAL-TIME TỪ INTERNET (ưu tiên dùng):"]
    for label, items in by_label.items():
        out.append(f"\n### {headings.get(label, label)}:")
        for r in items:
            out.append(f"- **{r.get('title','')}** ({r.get('url','')})\n  {r.get('content','')}")
    return "\n".join(out)


def _normalize(draft: dict) -> dict:
    """Ensure ids + meta are valid and consistent (the LLM-produced meta is placeholder)."""
    settings = get_settings()
    if not draft.get("itinerary_id"):
        draft["itinerary_id"] = "gen-" + uuid.uuid4().hex[:6]

    draft["meta"] = {
        "generated_by": "travelbot_multiagent",
        "model_used": f"{settings.llm_strong_provider}:{settings.llm_strong_model}",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "version": int((draft.get("meta") or {}).get("version", 1) or 1),
    }

    seen: set[str] = set()
    for day in draft.get("days", []):
        for a in day.get("activities", []):
            aid = a.get("id")
            if not aid or aid in seen:
                aid = "act-" + uuid.uuid4().hex[:6]
                a["id"] = aid
            seen.add(aid)
    return draft


async def planner_node(state: TravelAgentState) -> dict:
    slots = state.get("slots") or {}
    critic_feedback = state.get("critic_feedback")
    revision_count = state.get("revision_count", 0)
    if critic_feedback:
        revision_count += 1  # this run is a revision

    today = datetime.now().strftime("%Y-%m-%d")
    parts = [
        f"Yêu cầu người dùng: {last_user_text(state.get('messages', []))}",
        f"Hôm nay là {today}. Chỉ dùng ngày từ hôm nay trở đi, không dùng ngày quá khứ.",
        f"Thông tin chuyến đi: {json.dumps(slots, ensure_ascii=False)}",
    ]
    sr = _format_search(state.get("search_results"))
    if sr:
        parts.append(sr)
    weather_summary = state.get("weather_summary")
    if weather_summary:
        parts.append(
            "## DỮ LIỆU THỜI TIẾT (né khung giờ severe=true cho hoạt động ngoài trời):\n"
            + json.dumps(weather_summary, ensure_ascii=False)
        )
    if critic_feedback:
        parts.append("## PHẢN HỒI TỪ CRITIC — sửa đúng các điểm này:\n" + critic_feedback)

    itin = await structured_invoke(
        "strong", Itinerary,
        [SystemMessage(content=PLANNER_PROMPT), HumanMessage(content="\n\n".join(parts))],
    )
    if itin is None:
        print("[PLANNER] failed to produce a valid itinerary")
        return {"draft_itinerary": None, "revision_count": revision_count}
    draft = _normalize(itin.model_dump())

    n_days = len(draft.get("days", []))
    print(f"[PLANNER] built itinerary '{draft.get('title','')}' ({n_days} days, revision={revision_count})")
    return {"draft_itinerary": draft, "revision_count": revision_count}
