"""Presenter agent — streams the final user-facing prose (the only streaming planner node)."""
from langchain_core.messages import SystemMessage, HumanMessage

from ..llm_factory import get_chat_model
from ..prompts import PRESENTER_PROMPT
from ..state import TravelAgentState
from .common import brief_itinerary


async def presenter_node(state: TravelAgentState) -> dict:
    draft = state.get("draft_itinerary")
    if not draft:
        return {
            "final_itinerary": None,
            "full_response": "Xin lỗi, mình chưa tạo được lịch trình phù hợp. "
                             "Bạn mô tả rõ hơn điểm đến, số ngày và ngân sách giúp mình nhé!",
        }

    ctx = brief_itinerary(draft)
    severe = [w for w in (state.get("weather_summary") or []) if w.get("severe")]
    if severe:
        ctx += "\n\nKhung giờ thời tiết cần lưu ý:\n" + "\n".join(
            f"- {w.get('title')} ({w.get('time')} {w.get('day')}): {w.get('condition')}" for w in severe
        )

    llm = get_chat_model("presenter", streaming=True)
    full = ""
    async for chunk in llm.astream(
        [SystemMessage(content=PRESENTER_PROMPT), HumanMessage(content=ctx)]
    ):
        if chunk.content:
            full += chunk.content

    return {"final_itinerary": draft, "full_response": full}
