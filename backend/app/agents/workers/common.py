"""Shared helpers for agent workers."""
import json
import re
from typing import Optional, Type, TypeVar

from langchain_core.messages import HumanMessage, AIMessage, BaseMessage
from pydantic import BaseModel

from ..llm_factory import get_chat_model, Tier

_T = TypeVar("_T", bound=BaseModel)


def extract_json(text: str) -> Optional[dict]:
    """Pull a JSON object out of an LLM text response (handles ```json fences)."""
    if not text:
        return None
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    candidate = (m.group(1) if m else text).strip()
    start, end = candidate.find("{"), candidate.rfind("}")
    if start != -1 and end != -1:
        candidate = candidate[start:end + 1]
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        return None


async def structured_invoke(tier: Tier, schema: Type[_T], messages: list) -> Optional[_T]:
    """
    Call an LLM with structured output, robust across providers.

    Uses native tool-calling when the provider supports it (Anthropic/OpenAI);
    falls back to parsing a JSON fence when it returns JSON as text (gemini-3-flash).
    Returns the validated schema instance, or None on failure.
    """
    llm = get_chat_model(tier).with_structured_output(schema, include_raw=True)
    result = await llm.ainvoke(messages)
    parsed = result.get("parsed") if isinstance(result, dict) else result
    if parsed is not None:
        return parsed
    raw = result.get("raw") if isinstance(result, dict) else None
    data = extract_json(getattr(raw, "content", "") or "")
    if data is None:
        return None
    try:
        return schema(**data)
    except Exception:
        return None


# ── Slot completeness (for clarify gating) ──────────────────────────────────
# Các trường BẮT BUỘC phải có trước khi bắt đầu lập kế hoạch.
REQUIRED_FIELDS: list[str] = [
    "origin",
    "destination",
    "start_date",
    "num_days",
    "budget_vnd",
    "party_size",
]

# Nhãn + gợi ý đáp án dựng sẵn — dùng cho clarify khi LLM lỗi (fallback) và để gợi ý cho LLM.
FIELD_LABELS: dict[str, str] = {
    "origin": "Bạn xuất phát từ đâu?",
    "destination": "Bạn muốn đi đâu?",
    "start_date": "Bạn dự định khởi hành ngày nào?",
    "num_days": "Chuyến đi kéo dài mấy ngày?",
    "budget_vnd": "Ngân sách dự kiến khoảng bao nhiêu?",
    "party_size": "Mấy người cùng đi?",
}

FIELD_FALLBACK_OPTIONS: dict[str, list[str]] = {
    "origin": ["Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng"],
    "destination": [],
    "start_date": ["Cuối tuần này", "Tuần sau", "Tháng sau"],
    "num_days": ["2 ngày 1 đêm", "3 ngày 2 đêm", "4 ngày 3 đêm", "1 tuần"],
    "budget_vnd": ["Dưới 3 triệu", "3–5 triệu", "5–10 triệu", "Trên 10 triệu"],
    "party_size": ["1 người", "2 người", "Gia đình (3–4 người)", "Nhóm (5+ người)"],
}

# Câu mở đầu cố định cho thẻ clarify — cũng đóng vai trò "dấu hiệu" để né hỏi lặp vô hạn.
CLARIFY_INTRO = "Mình cần thêm vài thông tin để lập lịch trình chuẩn cho bạn nhé 👇"
CLARIFY_MARKER = "Mình cần thêm vài thông tin"  # substring ổn định để nhận diện lượt clarify
MAX_CLARIFY_ROUNDS = 2  # hỏi tối đa 2 lần rồi cứ lập với dữ liệu có được


def missing_required(slots: dict | None) -> list[str]:
    """Trả danh sách trường bắt buộc còn thiếu (theo thứ tự REQUIRED_FIELDS)."""
    s = slots or {}
    missing: list[str] = []
    for f in REQUIRED_FIELDS:
        if f == "num_days":
            # đủ nếu có num_days, HOẶC có cả start_date + end_date (suy ra được)
            if s.get("num_days") or (s.get("start_date") and s.get("end_date")):
                continue
            missing.append(f)
        elif not s.get(f):
            missing.append(f)
    return missing


def clarify_rounds(messages: list[dict]) -> int:
    """Đã hỏi clarify mấy lần (đếm tin nhắn assistant mang dấu hiệu clarify)."""
    return sum(
        1
        for m in messages or []
        if m.get("role") == "assistant" and CLARIFY_MARKER in (m.get("content") or "")
    )


def last_user_text(messages: list[dict]) -> str:
    for m in reversed(messages):
        if m.get("role") == "user":
            return m.get("content", "")
    return ""


def build_history(messages: list[dict], include_last: bool = True) -> list[BaseMessage]:
    """Convert stored messages to LangChain messages (skips empty)."""
    src = messages if include_last else messages[:-1]
    out: list[BaseMessage] = []
    for m in src:
        content = m.get("content", "")
        if not content.strip():
            continue
        if m.get("role") == "user":
            out.append(HumanMessage(content=content))
        else:
            out.append(AIMessage(content=content))
    return out


def brief_itinerary(draft: dict) -> str:
    """Compact text summary of an itinerary — fed to critic & presenter."""
    budget = draft.get("budget", {})
    lines = [
        f"{draft.get('title', '(lịch trình)')} — {draft.get('destination', '')} "
        f"({draft.get('start_date')} → {draft.get('end_date')})",
        f"Ngân sách dự kiến: {budget.get('total_estimated')} {budget.get('currency', 'VND')}",
    ]
    for day in draft.get("days", []):
        lines.append(f"Ngày {day.get('day')} ({day.get('date')}) — {day.get('theme', '')}:")
        for a in day.get("activities", []):
            loc = a.get("location", {}).get("name", "")
            lines.append(
                f"  • {a.get('time')} {a.get('title')} "
                f"[{a.get('type')}, {a.get('cost_estimate')}đ] @ {loc}"
            )
    return "\n".join(lines)
