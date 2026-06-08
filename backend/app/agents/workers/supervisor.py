"""Supervisor agent — LLM-based intent routing + slot extraction."""
from datetime import datetime

from langchain_core.messages import SystemMessage

from ..prompts import SUPERVISOR_PROMPT
from ..schemas import SupervisorDecision
from ..state import TravelAgentState
from .common import build_history, structured_invoke


async def supervisor_node(state: TravelAgentState) -> dict:
    # Image present → vision branch, no LLM routing needed.
    if state.get("image"):
        return {"intent": "analyze_image", "slots": {}}

    messages = state.get("messages", [])
    today = datetime.now().strftime("%Y-%m-%d")
    sys = SUPERVISOR_PROMPT + f"\n\nHôm nay là {today}. Dùng để quy đổi ngày tương đối (vd 'cuối tuần này') sang YYYY-MM-DD."
    lc = [SystemMessage(content=sys)] + build_history(messages)

    decision = await structured_invoke("fast", SupervisorDecision, lc)
    if decision is None:
        print("[SUPERVISOR] no decision, defaulting to general_chat")
        return {"intent": "general_chat", "slots": {}}

    slots = {
        "origin": decision.origin,
        "destination": decision.destination,
        "start_date": decision.start_date,
        "end_date": decision.end_date,
        "num_days": decision.num_days,
        "budget_vnd": decision.budget_vnd,
        "party_size": decision.party_size,
        "preferences": decision.preferences,
    }
    print(f"[SUPERVISOR] intent={decision.intent} | {decision.origin} → {decision.destination}")
    return {"intent": decision.intent, "slots": slots}
