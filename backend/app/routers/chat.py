"""
POST /api/v1/chat — SSE streaming chat endpoint (requires auth).

SSE event format:
    data: {"type": "thinking",   "content": "..."}
    data: {"type": "searching",  "content": "..."}
    data: {"type": "text",       "content": "<token>"}
    data: {"type": "itinerary",  "content": {<json>}}
    data: {"type": "error",      "content": "..."}
    data: {"type": "done"}
"""
import json
import re
import traceback

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from ..agents.graph import get_graph
from ..agents.state import TravelAgentState
from ..auth.dependencies import get_current_user
from ..db.base import ItineraryRepository
from ..db.dependencies import get_itinerary_repo
from ..models.chat import ChatRequest

router = APIRouter()


def _sse(event_type: str, content=None) -> str:
    payload: dict = {"type": event_type}
    if content is not None:
        payload["content"] = content
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


@router.post("/chat")
async def chat(
    request: ChatRequest,
    current_user: dict = Depends(get_current_user),
    itinerary_repo: ItineraryRepository = Depends(get_itinerary_repo),
):
    graph = get_graph()
    user_id = current_user["user_id"]

    initial_state: TravelAgentState = {
        "messages": [m.model_dump() for m in request.messages],
        "image": request.image,
        "intent": "",
        "search_results": None,
        "full_response": "",
        "itinerary": None,
    }

    async def generate():
        try:
            yield _sse("thinking", "TravelBot đang xử lý...")

            full_text = ""

            async for event in graph.astream_events(initial_state, version="v2"):
                event_name = event.get("event", "")
                node_name = event.get("name", "")

                if event_name == "on_chain_start":
                    if node_name == "router":
                        yield _sse("thinking", "Đang phân tích yêu cầu...")
                    elif node_name == "search":
                        yield _sse("searching", "Đang tìm kiếm thông tin mới nhất...")
                    elif node_name == "llm":
                        yield _sse("thinking", "TravelBot đang suy nghĩ...")

                elif event_name == "on_chat_model_stream":
                    chunk = event.get("data", {}).get("chunk")
                    if chunk is not None:
                        token = chunk.content if hasattr(chunk, "content") else ""
                        if token:
                            full_text += token
                            yield _sse("text", token)

            # Extract & persist itinerary — attach user_id
            json_match = re.search(r"```json\n([\s\S]*?)\n```", full_text)
            if json_match:
                try:
                    itinerary = json.loads(json_match.group(1))
                    itinerary["user_id"] = user_id  # scope to user
                    saved = await itinerary_repo.save(itinerary)
                    yield _sse("itinerary", saved)
                except (json.JSONDecodeError, Exception):
                    pass

            yield _sse("done")

        except Exception as exc:
            traceback.print_exc()
            yield _sse("error", str(exc))
            yield _sse("done")

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
