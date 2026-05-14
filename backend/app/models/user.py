from pydantic import BaseModel
from typing import Optional


class User(BaseModel):
    user_id: str        # = google_sub
    email: str
    name: str
    avatar_url: Optional[str] = None
    google_sub: str
    created_at: str
    preferences: dict = {}
