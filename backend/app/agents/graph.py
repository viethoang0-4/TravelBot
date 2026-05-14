"""
LangGraph travel-agent graph.

Topology:
                     ┌─ (plan_trip) ──→ search ─┐
    START → router ──┤                            ├──→ llm → END
                     └─ (other intents) ──────────┘
"""
from functools import lru_cache

from langgraph.graph import StateGraph, START, END

from .state import TravelAgentState
from .nodes import router_node, search_node, llm_node


def _route_after_router(state: TravelAgentState) -> str:
    """Chọn node tiếp theo sau router dựa vào intent."""
    if state.get("intent") == "plan_trip":
        return "search"
    return "llm"


@lru_cache(maxsize=1)
def get_graph():
    """Build and compile the LangGraph graph (cached singleton)."""
    builder = StateGraph(TravelAgentState)

    builder.add_node("router", router_node)
    builder.add_node("search", search_node)
    builder.add_node("llm", llm_node)

    builder.add_edge(START, "router")
    builder.add_conditional_edges("router", _route_after_router, {
        "search": "search",
        "llm": "llm",
    })
    builder.add_edge("search", "llm")
    builder.add_edge("llm", END)

    return builder.compile()
