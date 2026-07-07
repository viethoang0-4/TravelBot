"""
POST /api/v1/chat — SSE streaming chat endpoint (requires auth).

SSE event format:
    data: {"type": "thinking",   "content": "..."}
    data: {"type": "searching",  "content": "..."}
    data: {"type": "text",       "content": "<token>"}
    data: {"type": "itinerary",  "content": {<json>}}
    data: {"type": "questions",  "content": {"intro": "...", "questions": [...]}}
    data: {"type": "error",      "content": "..."}
    data: {"type": "done"}
"""
import json
import traceback

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from ..agents.graph import get_graph
from ..agents.state import TravelAgentState
from ..agents.workers.common import CLARIFY_INTRO, is_quota_error
from ..auth.dependencies import get_current_user
from ..db.base import ItineraryRepository
from ..db.dependencies import get_itinerary_repo
from ..limiter import limiter
from ..models.chat import ChatRequest

router = APIRouter()


def _sse(event_type: str, content=None, **extra) -> str:
    payload: dict = {"type": event_type}
    if content is not None:
        payload["content"] = content
    payload.update(extra)  # vd stage="drafting"|"enriching"|"ready" cho sự kiện itinerary
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


# Endpoint nặng nhất (mỗi lượt gọi LLM + Goong + Tavily) → siết chặt để bảo vệ quota.
@router.post("/chat")
@limiter.limit("20/minute")
async def chat(
    request: Request,
    body: ChatRequest,
    current_user: dict = Depends(get_current_user),
    itinerary_repo: ItineraryRepository = Depends(get_itinerary_repo),
):
    graph = get_graph()
    user_id = current_user["user_id"]

    initial_state: TravelAgentState = {
        "messages": [m.model_dump() for m in body.messages],
        "image": body.image,
        "current_itinerary": body.current_itinerary,
        "user_preferences": current_user.get("preferences") or {},  # cá nhân hóa: nạp hồ sơ sở thích
        "revision_count": 0,
    }

    # Status line shown when each agent/node starts (uses existing thinking/searching events)
    _STATUS = {
        "supervisor": ("thinking", "Đang phân tích yêu cầu..."),
        "clarify": ("thinking", "Đang xác định thông tin cần thiết..."),
        "research": ("searching", "Đang tìm thông tin mới nhất..."),
        "social": ("searching", "Đang tìm review & vlog thực tế..."),
        "planner": ("thinking", "Đang lập lịch trình..."),
        "grounding": ("searching", "Đang xác thực địa điểm & tuyến đường thật (Goong)..."),
        "weather": ("searching", "Đang kiểm tra thời tiết..."),
        "critic": ("thinking", "Đang rà soát tính khả thi..."),
        "presenter": ("thinking", "Đang hoàn thiện..."),
        "chat": ("thinking", "Compasso đang suy nghĩ..."),
    }

    async def generate():
        try:
            yield _sse("thinking", "Compasso đang xử lý...")

            captured_itinerary = None
            captured_questions = None

            async for event in graph.astream_events(initial_state, version="v2"):
                event_name = event.get("event", "")
                node_name = event.get("name", "")

                if event_name == "on_chain_start" and node_name in _STATUS:
                    etype, msg = _STATUS[node_name]
                    yield _sse(etype, msg)

                elif event_name == "on_chat_model_stream":
                    # CHỈ forward token của presenter/chat (node sinh văn xuôi cho người dùng).
                    # Các node khác (planner/critic/...) cũng phát on_chat_model_stream khi dùng
                    # ChatOpenAI/ckey (khác Gemini) → không được để JSON thô rò ra UI.
                    src_node = (event.get("metadata") or {}).get("langgraph_node", "")
                    if src_node in ("presenter", "chat"):
                        chunk = event.get("data", {}).get("chunk")
                        if chunk is not None:
                            token = chunk.content if hasattr(chunk, "content") else ""
                            if token:
                                yield _sse("text", token)

                elif event_name == "on_chain_end":
                    out = event.get("data", {}).get("output")
                    if isinstance(out, dict):
                        if out.get("final_itinerary"):
                            captured_itinerary = out["final_itinerary"]
                        if out.get("clarify_questions"):
                            captured_questions = out["clarify_questions"]
                        # Hiển thị SỚM (progressive): bắn lịch trình ngay khi planner xong
                        # (stage=drafting, tọa độ tạm) rồi lại bắn sau weather (stage=enriching,
                        # đã có tọa độ/tuyến Goong + cờ thời tiết) — người dùng thấy lịch trình
                        # trong vài giây thay vì đợi cả đồ thị. Cùng itinerary_id nên FE cập nhật
                        # TẠI CHỖ (planner giữ id ổn định qua các vòng revise). Chưa lưu DB ở đây.
                        if node_name == "planner" and out.get("draft_itinerary"):
                            yield _sse("itinerary", out["draft_itinerary"], stage="drafting")
                        elif node_name == "weather" and out.get("draft_itinerary"):
                            yield _sse("itinerary", out["draft_itinerary"], stage="enriching")
                        # refuse node không stream token → đẩy câu từ chối cố định ra dưới dạng text
                        if node_name == "refuse" and out.get("full_response"):
                            yield _sse("text", out["full_response"])

            # Clarify branch: ask the user for the missing info instead of planning.
            if captured_questions:
                yield _sse(
                    "questions",
                    {"intro": CLARIFY_INTRO, "questions": captured_questions},
                )

            # Persist the validated itinerary — attach user_id. stage=ready → FE mở khoá
            # sửa/chốt (bản cuối đã qua grounding + weather + critic).
            if captured_itinerary:
                try:
                    captured_itinerary["user_id"] = user_id  # scope to user
                    saved = await itinerary_repo.save(captured_itinerary)
                    yield _sse("itinerary", saved, stage="ready")
                except Exception as exc:
                    print(f"[CHAT] save itinerary failed: {exc}")

            yield _sse("done")

        except Exception as exc:
            traceback.print_exc()
            if is_quota_error(exc):
                yield _sse(
                    "error",
                    "Hệ thống AI đang quá tải hạn mức (quota) — vui lòng thử lại sau ít phút.",
                )
            else:
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
