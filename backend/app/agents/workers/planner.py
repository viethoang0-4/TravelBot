"""Planner agent — builds (or revises) the itinerary as structured output."""
import json
import uuid
from datetime import datetime, timezone

from langchain_core.messages import SystemMessage, HumanMessage

from ..prompts import PLANNER_PROMPT
from ..state import TravelAgentState
from .common import last_user_text, structured_invoke
from ..llm_factory import model_for, provider_for
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


_PACE_LABEL = {
    "relaxed": "thong thả (ít điểm/ngày, nhiều thời gian nghỉ)",
    "balanced": "cân bằng",
    "packed": "dày đặc (tối đa điểm tham quan/ngày)",
}
_BUDGET_LABEL = {
    "budget": "tiết kiệm",
    "moderate": "vừa phải",
    "luxury": "cao cấp",
}


def _format_preferences(prefs: dict | None) -> str:
    """Hồ sơ sở thích BỀN của user → khối ngữ cảnh cá nhân hóa (chỉ gồm trường có giá trị)."""
    if not prefs:
        return ""
    lines: list[str] = []
    if prefs.get("interests"):
        lines.append(f"- Sở thích: {', '.join(prefs['interests'])}")
    if prefs.get("pace"):
        lines.append(f"- Nhịp đi mong muốn: {_PACE_LABEL.get(prefs['pace'], prefs['pace'])}")
    if prefs.get("budget_level"):
        lines.append(f"- Mức chi tiêu ưa thích: {_BUDGET_LABEL.get(prefs['budget_level'], prefs['budget_level'])}")
    if prefs.get("food"):
        lines.append(f"- Ẩm thực ưa thích: {prefs['food']}")
    if prefs.get("avoid"):
        lines.append(f"- Cần tránh: {prefs['avoid']}")
    if prefs.get("notes"):
        lines.append(f"- Ghi chú thêm: {prefs['notes']}")
    if not lines:
        return ""
    return (
        "## HỒ SƠ SỞ THÍCH CỦA NGƯỜI DÙNG (cá nhân hóa — ưu tiên tôn trọng khi chọn "
        "địa điểm, quán ăn, nhịp độ; nếu yêu cầu lần này mâu thuẫn thì theo yêu cầu lần này):\n"
        + "\n".join(lines)
    )


def _format_social(social_results: list[dict] | None) -> str:
    if not social_results:
        return ""
    out = ["## TRẢI NGHIỆM THỰC TẾ TỪ WEB & VLOG (review/blog thật + vlog YouTube — ưu tiên dùng):"]
    for r in social_results:
        plat = r.get("platform", "web")
        title = r.get("title", "")
        src = f" — nguồn {plat}: {r.get('url', '')}"
        out.append(f"- **{title}**: {r.get('text', '')}{src}")
    return "\n".join(out)


def _normalize(draft: dict) -> dict:
    """Ensure ids + meta are valid and consistent (the LLM-produced meta is placeholder)."""
    if not draft.get("itinerary_id"):
        draft["itinerary_id"] = "gen-" + uuid.uuid4().hex[:6]

    draft["meta"] = {
        "generated_by": "compasso_multiagent",
        "model_used": f"{provider_for('planner')}:{model_for('planner')}",
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

    current = state.get("current_itinerary")
    is_modify = state.get("intent") == "modify_plan" and bool(current)

    today = datetime.now().strftime("%Y-%m-%d")
    parts = [
        f"Yêu cầu người dùng: {last_user_text(state.get('messages', []))}",
        f"Hôm nay là {today}. Chỉ dùng ngày từ hôm nay trở đi, không dùng ngày quá khứ.",
        f"Thông tin chuyến đi: {json.dumps(slots, ensure_ascii=False)}",
    ]
    pref = _format_preferences(state.get("user_preferences"))
    if pref:
        parts.append(pref)
    if is_modify:
        parts.append(
            "## CHẾ ĐỘ SỬA — LỊCH TRÌNH HIỆN TẠI (chỉ đổi đúng phần người dùng yêu cầu, GIỮ NGUYÊN "
            "phần còn lại y hệt: id hoạt động, tọa độ, giờ; GIỮ NGUYÊN itinerary_id):\n"
            + json.dumps(current, ensure_ascii=False)
        )
    sr = _format_search(state.get("search_results"))
    if sr:
        parts.append(sr)
    so = _format_social(state.get("social_results"))
    if so:
        parts.append(so)
    weather_summary = state.get("weather_summary")
    if weather_summary:
        parts.append(
            "## DỮ LIỆU THỜI TIẾT (né khung giờ severe=true cho hoạt động ngoài trời):\n"
            + json.dumps(weather_summary, ensure_ascii=False)
        )
    if critic_feedback:
        parts.append("## PHẢN HỒI TỪ CRITIC — sửa đúng các điểm này:\n" + critic_feedback)

    itin = await structured_invoke(
        "planner", Itinerary,
        [SystemMessage(content=PLANNER_PROMPT), HumanMessage(content="\n\n".join(parts))],
    )
    if itin is None:
        print("[PLANNER] failed to produce a valid itinerary")
        return {"draft_itinerary": None, "revision_count": revision_count}
    draft = _normalize(itin.model_dump())

    # Chế độ sửa: giữ nguyên itinerary_id của lịch trình gốc + tăng version (cập nhật tại chỗ)
    if is_modify:
        draft["itinerary_id"] = current.get("itinerary_id") or draft["itinerary_id"]
        cur_ver = int((current.get("meta") or {}).get("version", 1) or 1)
        draft["meta"]["version"] = cur_ver + 1

    n_days = len(draft.get("days", []))
    mode = "modified" if is_modify else "built"
    print(f"[PLANNER] {mode} itinerary '{draft.get('title','')}' ({n_days} days, revision={revision_count})")
    return {"draft_itinerary": draft, "revision_count": revision_count}
