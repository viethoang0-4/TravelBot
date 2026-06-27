"""
User preference endpoints (cá nhân hóa — hồ sơ sở thích tường minh).

GET /api/v1/users/me/preferences  — hồ sơ sở thích hiện tại của người dùng
PUT /api/v1/users/me/preferences  — lưu/ghi đè hồ sơ sở thích

Hồ sơ này được nạp vào Planner ở mỗi lần lập lịch (xem agents/workers/planner.py)
để cá nhân hóa lịch trình mà KHÔNG cần huấn luyện mô hình (điều kiện hóa ngữ cảnh).
"""
from typing import Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..auth.dependencies import get_current_user
from ..db.base import UserRepository
from ..db.dependencies import get_user_repo

router = APIRouter()


class UserPreferences(BaseModel):
    interests: list[str] = []                                  # vd: ẩm thực, biển, văn hoá
    pace: Optional[Literal["relaxed", "balanced", "packed"]] = None
    budget_level: Optional[Literal["budget", "moderate", "luxury"]] = None
    food: str = ""                                             # món/khẩu vị ưa thích (tự do)
    avoid: str = ""                                            # điều cần tránh (tự do)
    notes: str = ""                                            # ghi chú thêm cho Compasso


@router.get("/users/me/preferences")
async def get_my_preferences(current_user: dict = Depends(get_current_user)):
    return current_user.get("preferences") or {}


@router.put("/users/me/preferences")
async def update_my_preferences(
    body: UserPreferences,
    current_user: dict = Depends(get_current_user),
    user_repo: UserRepository = Depends(get_user_repo),
):
    user = await user_repo.update_preferences(current_user["user_id"], body.model_dump())
    return user.get("preferences") or {}
