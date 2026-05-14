"""
LangGraph node functions.

Each node receives the full TravelAgentState and returns a dict with
only the keys it wants to update (partial state update).
"""
import re
import json
import asyncio
from datetime import datetime
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_google_genai import ChatGoogleGenerativeAI

from .state import TravelAgentState
from .prompts import SYSTEM_PROMPT, VISION_PROMPT
from ..config import get_settings

try:
    from tavily import AsyncTavilyClient
    _TAVILY_AVAILABLE = True
except ImportError:
    _TAVILY_AVAILABLE = False

# Danh sách điểm đến phổ biến để extract từ message
_DESTINATIONS = [
    "hà nội", "hồ chí minh", "sài gòn", "đà nẵng", "hội an", "huế",
    "nha trang", "đà lạt", "phú quốc", "sapa", "hạ long", "ninh bình",
    "mũi né", "phan thiết", "quy nhon", "quy nhơn", "cần thơ", "vũng tàu",
    "hải phòng", "côn đảo", "bình ba", "phong nha", "mộc châu",
]

# ---------------------------------------------------------------------------
# LLM singleton (lazy-initialised so settings are loaded first)
# ---------------------------------------------------------------------------

_llm: ChatGoogleGenerativeAI | None = None

def _get_llm() -> ChatGoogleGenerativeAI:
    global _llm
    if _llm is None:
        settings = get_settings()
        _llm = ChatGoogleGenerativeAI(
            model=settings.gemini_model,
            google_api_key=settings.gemini_api_key,
            streaming=True,
        )
    return _llm


# ---------------------------------------------------------------------------
# Keyword lists for intent detection
# ---------------------------------------------------------------------------

_PLAN_KEYWORDS = [
    "lịch trình", "kế hoạch", "chuyến đi", "du lịch", "ngân sách",
    "trip", "travel", "tour", "đi đến", "đi thăm", "tham quan",
    "khách sạn", "hotel", "bay", "vé máy bay", "ngày đi", "ngày về",
    "bao nhiêu tiền", "chi phí", "budget",
]


# ---------------------------------------------------------------------------
# Node 1: router_node
# Classifies intent from the last user message.
# ---------------------------------------------------------------------------

async def router_node(state: TravelAgentState) -> dict:
    messages = state.get("messages", [])
    image = state.get("image")

    if image:
        return {"intent": "analyze_image"}

    last_content = ""
    for m in reversed(messages):
        if m.get("role") == "user":
            last_content = m.get("content", "").lower()
            break

    if any(kw in last_content for kw in _PLAN_KEYWORDS):
        return {"intent": "plan_trip"}

    return {"intent": "general_chat"}


# ---------------------------------------------------------------------------
# Helpers for search_node
# ---------------------------------------------------------------------------

def _extract_destination(text: str) -> str:
    """Tìm tên điểm đến trong message. Fallback về text gốc nếu không tìm thấy."""
    lower = text.lower()
    for dest in _DESTINATIONS:
        if dest in lower:
            # Trả về dạng title-case (VD: "đà nẵng" → "Đà Nẵng")
            return dest.title()
    return text[:60]


def _extract_month_year(text: str) -> tuple[str, str]:
    """Trả về (month_str, year_str) từ message. Fallback về tháng hiện tại."""
    now = datetime.now()
    # Tìm "tháng X" hoặc "tháng XX"
    m = re.search(r"tháng\s*(\d{1,2})", text, re.IGNORECASE)
    month = m.group(1) if m else str(now.month)
    # Tìm năm 4 chữ số
    y = re.search(r"\b(20\d{2})\b", text)
    year = y.group(1) if y else str(now.year)
    return month, year


async def _tavily_search(client, query: str, label: str, max_results: int = 4) -> list[dict]:
    """Gọi 1 Tavily query và trả về danh sách kết quả có label."""
    try:
        resp = await client.search(
            query=query,
            max_results=max_results,
            search_depth="basic",
            include_answer=False,
        )
        results = []
        for r in resp.get("results", []):
            results.append({
                "label": label,
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "content": r.get("content", "")[:400],
            })
        return results
    except Exception as e:
        print(f"[TAVILY] Lỗi query '{label}': {e}")
        return []


# ---------------------------------------------------------------------------
# Node 2: search_node
# Chạy 3 targeted queries song song để lấy dữ liệu có mục đích rõ ràng.
# Skipped gracefully khi TAVILY_API_KEY không có hoặc package chưa cài.
# ---------------------------------------------------------------------------

async def search_node(state: TravelAgentState) -> dict:
    settings = get_settings()

    if not _TAVILY_AVAILABLE or not settings.tavily_api_key:
        return {"search_results": []}

    messages = state.get("messages", [])
    last_content = ""
    for m in reversed(messages):
        if m.get("role") == "user":
            last_content = m.get("content", "")
            break

    destination = _extract_destination(last_content)
    month, year = _extract_month_year(last_content)

    client = AsyncTavilyClient(api_key=settings.tavily_api_key)

    # 3 queries song song, mỗi cái có mục đích khác nhau
    queries = [
        (
            f"lễ hội sự kiện {destination} tháng {month} {year} lịch",
            "events",
        ),
        (
            f"điểm đến ẩn ít người biết {destination} {year} review thực tế",
            "hidden_gems",
        ),
        (
            f"chi phí thực tế {destination} {year} giá vé ăn uống khách sạn",
            "prices",
        ),
    ]

    tasks = [_tavily_search(client, q, label) for q, label in queries]
    all_results_nested = await asyncio.gather(*tasks)

    # Gộp và in log rõ ràng
    all_results: list[dict] = []
    print("\n" + "="*60)
    print(f"[TAVILY] Destination: {destination} | Tháng: {month}/{year}")
    for results, (query, label) in zip(all_results_nested, queries):
        print(f"\n  [{label.upper()}] Query: {query}")
        print(f"  → {len(results)} kết quả:")
        for r in results:
            print(f"     • {r['title']}")
            print(f"       {r['url']}")
            print(f"       {r['content'][:100]}...")
        all_results.extend(results)
    print("="*60 + "\n")

    return {"search_results": all_results}


# ---------------------------------------------------------------------------
# Node 3: llm_node
# Main LLM call.  Uses llm.astream() so that graph.astream_events() captures
# each token and re-emits it as an on_chat_model_stream event.
# ---------------------------------------------------------------------------

async def llm_node(state: TravelAgentState) -> dict:
    messages = state.get("messages", [])
    image = state.get("image")
    intent = state.get("intent", "general_chat")
    search_results = state.get("search_results")

    llm = _get_llm()

    # Inject ngày hôm nay để Gemini không sinh ngày sai (dùng training cutoff)
    today_str = datetime.now().strftime("%d/%m/%Y")
    system_with_date = (
        SYSTEM_PROMPT
        + f"\n\n**Hôm nay là ngày {today_str}.** "
        "Khi lập lịch trình, hãy dùng ngày thực tế từ hôm nay trở đi. "
        "Không bao giờ dùng ngày trong quá khứ."
    )

    # Build LangChain message list
    lc_messages: list = [SystemMessage(content=system_with_date)]

    # History: all messages except the last user message
    for msg in messages[:-1]:
        content = msg.get("content", "")
        if not content.strip():
            continue
        if msg["role"] == "user":
            lc_messages.append(HumanMessage(content=content))
        else:
            lc_messages.append(AIMessage(content=content))

    # Inject Tavily search results với cấu trúc rõ ràng theo từng loại
    if search_results:
        events   = [r for r in search_results if r.get("label") == "events"]
        gems     = [r for r in search_results if r.get("label") == "hidden_gems"]
        prices   = [r for r in search_results if r.get("label") == "prices"]

        ctx = "## Dữ liệu real-time từ Internet (ưu tiên dùng thay vì ước tính):\n\n"

        if events:
            ctx += "### [SỰ KIỆN / LỄ HỘI] — Đưa vào Activity với tên thực, thêm tag 'event':\n"
            for r in events:
                ctx += f"- **{r['title']}** ({r['url']})\n  {r['content']}\n\n"

        if gems:
            ctx += "### [HIDDEN GEMS] — Dùng cho section hidden_gems, đặt source = URL bên dưới:\n"
            for r in gems:
                ctx += f"- **{r['title']}** (source: {r['url']})\n  {r['content']}\n\n"

        if prices:
            ctx += "### [GIÁ CẢ THỰC TẾ] — Dùng cho cost_estimate, không ước tính:\n"
            for r in prices:
                ctx += f"- **{r['title']}**\n  {r['content']}\n\n"

        # Lấy tất cả URLs để đưa vào meta.web_sources
        all_urls = [r["url"] for r in search_results if r.get("url")]
        ctx += f"\n_web_sources để đưa vào meta: {json.dumps(all_urls[:6])}_\n"

        lc_messages.append(HumanMessage(content=ctx))

    # Last user message (possibly with image)
    last_msg = messages[-1] if messages else {"content": ""}
    last_content = last_msg.get("content", "")

    if image:
        # Gemini vision: pass image as inline_data via a list of content parts
        image_content: Any = [
            {
                "type": "text",
                "text": VISION_PROMPT + "\n\n" + (last_content or "Phân tích ảnh này giúp tôi."),
            },
            {
                "type": "image_url",
                "image_url": {"url": image},
            },
        ]
        lc_messages.append(HumanMessage(content=image_content))
    else:
        lc_messages.append(HumanMessage(content=last_content))

    # Stream LLM output — graph.astream_events() will re-emit each chunk
    full_response = ""
    async for chunk in llm.astream(lc_messages):
        if chunk.content:
            full_response += chunk.content

    # Extract embedded itinerary JSON if present
    itinerary: dict | None = None
    json_match = re.search(r"```json\n([\s\S]*?)\n```", full_response)
    if json_match:
        try:
            itinerary = json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass

    return {"full_response": full_response, "itinerary": itinerary}
