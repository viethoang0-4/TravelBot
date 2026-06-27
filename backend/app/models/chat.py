from pydantic import BaseModel
from typing import Optional, Literal


class MessageInput(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[MessageInput]
    image: Optional[str] = None   # base64 data URL
    session_id: Optional[str] = None
    current_itinerary: Optional[dict] = None  # lịch trình đang xem (để sửa tại chỗ khi modify_plan)
