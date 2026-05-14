from pydantic import BaseModel
from typing import Optional, Literal


class Notification(BaseModel):
    notification_id: str
    user_id: str
    itinerary_id: Optional[str] = None
    activity_id: Optional[str] = None
    title: str
    body: str
    severity: Literal["info", "warning", "critical"] = "info"
    created_at: str
    read: bool = False
