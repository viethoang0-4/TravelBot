"""
Social agent — lấy trải nghiệm/review thật từ web (Tavily) + vlog YouTube, tìm
TRỰC TIẾP trong luồng request (không vector DB) rồi đưa thẳng cho planner.

Bỏ qua khi tắt tính năng / không có điểm đến / đang sửa lịch trình. Mọi lỗi
(thiếu key, lỗi mạng...) → degrade về social_results=[] để pipeline không vỡ.
"""
from ..state import TravelAgentState
from ...config import get_settings


async def social_node(state: TravelAgentState) -> dict:
    settings = get_settings()
    slots = state.get("slots") or {}
    dest = (slots.get("destination") or "").strip()

    if (
        not settings.social_enabled
        or not dest
        or state.get("intent") == "modify_plan"  # sửa lịch trình thì không cần review mới
    ):
        return {"social_results": []}

    try:
        from ...services.social.connectors import gather_experiences
        from ...services.social.trace import section, log

        section(f"SOCIAL NODE: '{dest}'")
        results = await gather_experiences(dest)
        log(f"[SOCIAL NODE] giao {len(results)} review/vlog cho planner")
        section(f"HẾT SOCIAL NODE: '{dest}'")
        return {"social_results": results}
    except Exception as exc:
        print(f"[SOCIAL] degraded (skip): {exc}")
        return {"social_results": []}
