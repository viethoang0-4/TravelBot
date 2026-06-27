"""
LangGraph multi-agent travel graph.

Topology:
    START → supervisor ─┬─ plan_trip/modify_plan → research → social → planner → grounding → weather → critic
                        │                                  ▲ (web review + vlog)  (Goong: tọa độ+route thật)  │
                        │                              planner ─┴─ revise (< max loops) ────────────────────┤
                        │                                                                                    │
                        │                                                   approved → presenter → END
                        └─ general_chat/analyze_image ────────────────────────────→ chat → END
"""
from functools import lru_cache

from langgraph.graph import StateGraph, START, END

from ..config import get_settings
from .state import TravelAgentState
from .workers.supervisor import supervisor_node
from .workers.clarify import clarify_node
from .workers.refuse import refuse_node
from .workers.research import research_node
from .workers.social import social_node
from .workers.planner import planner_node
from .workers.grounding import grounding_node
from .workers.weather_agent import weather_node
from .workers.critic import critic_node
from .workers.presenter import presenter_node
from .workers.chat import chat_node
from .workers.common import missing_required, clarify_rounds, MAX_CLARIFY_ROUNDS

# Baseline (single-LLM) nodes — kept for later evaluation/comparison.
from .nodes import router_node, search_node, llm_node


def _route_after_supervisor(state: TravelAgentState) -> str:
    intent = state.get("intent")
    if intent == "plan_trip":
        # Thiếu trường bắt buộc & chưa hỏi quá số lần cho phép → hỏi làm rõ trước.
        if missing_required(state.get("slots")) and (
            clarify_rounds(state.get("messages", [])) < MAX_CLARIFY_ROUNDS
        ):
            return "clarify"
        return "research"
    if intent == "modify_plan":
        return "research"
    if intent == "off_topic":
        return "refuse"
    return "chat"


def _route_after_critic(state: TravelAgentState) -> str:
    settings = get_settings()
    if (
        state.get("critic_verdict") == "revise"
        and state.get("revision_count", 0) < settings.max_reflection_loops
    ):
        return "planner"
    return "presenter"


@lru_cache(maxsize=1)
def get_graph():
    """Build & compile the multi-agent graph (cached singleton)."""
    builder = StateGraph(TravelAgentState)

    builder.add_node("supervisor", supervisor_node)
    builder.add_node("clarify", clarify_node)
    builder.add_node("refuse", refuse_node)
    builder.add_node("research", research_node)
    builder.add_node("social", social_node)
    builder.add_node("planner", planner_node)
    builder.add_node("grounding", grounding_node)
    builder.add_node("weather", weather_node)
    builder.add_node("critic", critic_node)
    builder.add_node("presenter", presenter_node)
    builder.add_node("chat", chat_node)

    builder.add_edge(START, "supervisor")
    builder.add_conditional_edges(
        "supervisor",
        _route_after_supervisor,
        {"clarify": "clarify", "refuse": "refuse", "research": "research", "chat": "chat"},
    )
    builder.add_edge("clarify", END)
    builder.add_edge("refuse", END)
    builder.add_edge("research", "social")
    builder.add_edge("social", "planner")
    builder.add_edge("planner", "grounding")
    builder.add_edge("grounding", "weather")
    builder.add_edge("weather", "critic")
    builder.add_conditional_edges(
        "critic", _route_after_critic, {"planner": "planner", "presenter": "presenter"}
    )
    builder.add_edge("presenter", END)
    builder.add_edge("chat", END)

    return builder.compile()


def _route_after_router(state: TravelAgentState) -> str:
    return "search" if state.get("intent") == "plan_trip" else "llm"


@lru_cache(maxsize=1)
def get_baseline_graph():
    """The original single-LLM pipeline (router → search → llm). For eval comparison."""
    builder = StateGraph(TravelAgentState)
    builder.add_node("router", router_node)
    builder.add_node("search", search_node)
    builder.add_node("llm", llm_node)
    builder.add_edge(START, "router")
    builder.add_conditional_edges("router", _route_after_router, {"search": "search", "llm": "llm"})
    builder.add_edge("search", "llm")
    builder.add_edge("llm", END)
    return builder.compile()
