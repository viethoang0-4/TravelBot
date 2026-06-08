"""Clarify agent — khi plan_trip còn thiếu trường bắt buộc, sinh bộ câu hỏi làm rõ (1 lượt LLM)."""
import json
from datetime import datetime

from langchain_core.messages import SystemMessage, HumanMessage

from ..prompts import CLARIFY_PROMPT
from ..schemas import ClarifyQuestions
from ..state import TravelAgentState
from .common import (
    CLARIFY_INTRO,
    FIELD_FALLBACK_OPTIONS,
    FIELD_LABELS,
    missing_required,
    structured_invoke,
)


def _fallback_question(field: str) -> dict:
    return {
        "field": field,
        "question": FIELD_LABELS.get(field, "Bạn bổ sung thông tin này giúp mình nhé?"),
        "options": FIELD_FALLBACK_OPTIONS.get(field, []),
    }


async def clarify_node(state: TravelAgentState) -> dict:
    slots = state.get("slots") or {}
    missing = missing_required(slots)
    if not missing:
        return {"clarify_questions": [], "full_response": ""}

    today = datetime.now().strftime("%Y-%m-%d")
    ctx = (
        f"Hôm nay là {today}.\n"
        f"Thông tin đã biết: {json.dumps(slots, ensure_ascii=False)}\n"
        f"Các trường CÒN THIẾU (chỉ hỏi đúng những trường này): "
        f"{', '.join(f'{f} ({FIELD_LABELS.get(f, f)})' for f in missing)}"
    )

    result = await structured_invoke(
        "fast", ClarifyQuestions,
        [SystemMessage(content=CLARIFY_PROMPT), HumanMessage(content=ctx)],
    )

    # Gom câu hỏi LLM theo field, chỉ giữ trường còn thiếu; trường nào LLM bỏ sót → fallback.
    by_field: dict[str, dict] = {}
    if result is not None:
        for q in result.questions:
            if q.field in missing and q.field not in by_field:
                by_field[q.field] = {
                    "field": q.field,
                    "question": q.question.strip() or FIELD_LABELS.get(q.field, ""),
                    "options": [o for o in (q.options or []) if o.strip()][:4],
                }

    questions = [by_field.get(f) or _fallback_question(f) for f in missing]
    print(f"[CLARIFY] asking {len(questions)} field(s): {', '.join(missing)}")
    return {"clarify_questions": questions, "full_response": CLARIFY_INTRO}
