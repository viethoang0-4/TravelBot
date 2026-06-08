"""Refuse node — phản hồi CỐ ĐỊNH cho yêu cầu ngoài phạm vi du lịch (không gọi LLM → miễn nhiễm injection)."""
from ..prompts import REFUSAL_MSG
from ..state import TravelAgentState


async def refuse_node(state: TravelAgentState) -> dict:
    print("[REFUSE] off-topic / injection attempt → fixed travel-only reply")
    return {"full_response": REFUSAL_MSG}
