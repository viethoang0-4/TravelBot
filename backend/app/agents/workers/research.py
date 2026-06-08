"""Research agent — LLM decides what to search, then runs Tavily in parallel."""
import asyncio
import json

from langchain_core.messages import SystemMessage, HumanMessage

from ..prompts import RESEARCH_PROMPT
from ..schemas import ResearchPlan
from ..state import TravelAgentState
from ..nodes import _tavily_search, _TAVILY_AVAILABLE  # reuse existing helper
from .common import structured_invoke
from ...config import get_settings


async def research_node(state: TravelAgentState) -> dict:
    settings = get_settings()
    if not _TAVILY_AVAILABLE or not settings.tavily_api_key:
        return {"search_results": []}

    slots = state.get("slots") or {}
    if not slots.get("destination"):
        return {"search_results": []}

    ctx = (
        "Thông tin chuyến đi để quyết định truy vấn:\n"
        + json.dumps(slots, ensure_ascii=False)
    )
    plan = await structured_invoke(
        "fast", ResearchPlan,
        [SystemMessage(content=RESEARCH_PROMPT), HumanMessage(content=ctx)],
    )
    if plan is None:
        print("[RESEARCH] query planning failed")
        return {"search_results": []}

    queries = plan.queries[:4]
    if not queries:
        return {"search_results": []}

    from tavily import AsyncTavilyClient
    client = AsyncTavilyClient(api_key=settings.tavily_api_key)
    tasks = [_tavily_search(client, q.query, q.label) for q in queries]
    nested = await asyncio.gather(*tasks)
    results = [r for sub in nested for r in sub]

    print(f"[RESEARCH] {len(queries)} LLM-chosen queries → {len(results)} results")
    return {"search_results": results}
