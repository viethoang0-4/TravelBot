from typing import Optional
from typing_extensions import TypedDict


class TravelAgentState(TypedDict, total=False):
    # ── Input ────────────────────────────────────────────────
    messages: list[dict]              # [{"role": "user"|"assistant", "content": "..."}]
    image: Optional[str]              # base64 data URL, or None

    # ── Set by supervisor_node ───────────────────────────────
    intent: str                       # plan_trip | modify_plan | general_chat | analyze_image
    slots: Optional[dict]             # origin, destination, start_date, end_date, num_days, budget_vnd, party_size, preferences[]

    # ── Set by clarify_node (khi plan_trip thiếu trường bắt buộc) ─
    clarify_questions: Optional[list[dict]]  # [{field, question, options[]}, ...]

    # ── Set by research_node ─────────────────────────────────
    search_results: Optional[list[dict]]   # [{label, title, url, content}, ...]

    # ── Set by planner_node ──────────────────────────────────
    draft_itinerary: Optional[dict]   # itinerary JSON (validated against Itinerary model)

    # ── Set by weather_node ──────────────────────────────────
    weather_summary: Optional[list[dict]]  # [{day, activity_id, time, condition, severe}]

    # ── Set by critic_node ───────────────────────────────────
    critic_verdict: Optional[str]     # "approved" | "revise"
    critic_feedback: Optional[str]    # consolidated issues + suggestions for the planner
    revision_count: int               # how many times the planner has revised

    # ── Set by presenter_node / chat_node ────────────────────
    final_itinerary: Optional[dict]   # the itinerary delivered to the user
    full_response: str                # complete LLM prose output
