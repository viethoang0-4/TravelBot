from typing import Optional
from typing_extensions import TypedDict


class TravelAgentState(TypedDict):
    # Input
    messages: list[dict]              # [{"role": "user"|"assistant", "content": "..."}]
    image: Optional[str]              # base64 data URL, or None

    # Set by router_node
    intent: str                       # "plan_trip" | "general_chat" | "analyze_image"

    # Set by search_node (only when intent == "plan_trip")
    search_results: Optional[list[dict]]  # [{title, url, content}, ...]

    # Set by llm_node
    full_response: str                # complete LLM output text
    itinerary: Optional[dict]         # parsed itinerary JSON (if any)
