"""Chat node — general Q&A and image analysis (streaming, non-planning branch)."""
from datetime import datetime
from typing import Any

from langchain_core.messages import SystemMessage, HumanMessage

from ..llm_factory import get_chat_model
from ..prompts import SYSTEM_PROMPT, VISION_PROMPT
from ..state import TravelAgentState
from .common import build_history, last_user_text


async def chat_node(state: TravelAgentState) -> dict:
    messages = state.get("messages", [])
    image = state.get("image")

    today = datetime.now().strftime("%d/%m/%Y")
    lc: list = [SystemMessage(content=SYSTEM_PROMPT + f"\n\nHôm nay là ngày {today}.")]
    lc += build_history(messages, include_last=False)

    last = last_user_text(messages)
    if image:
        content: Any = [
            {"type": "text", "text": VISION_PROMPT + "\n\n" + (last or "Phân tích ảnh này giúp tôi.")},
            {"type": "image_url", "image_url": {"url": image}},
        ]
        lc.append(HumanMessage(content=content))
    else:
        lc.append(HumanMessage(content=last))

    llm = get_chat_model("fast", streaming=True)
    full = ""
    async for chunk in llm.astream(lc):
        if chunk.content:
            full += chunk.content

    return {"full_response": full}
