"""
Notification endpoints.

GET   /api/v1/notifications              — list notifications for current user
PATCH /api/v1/notifications/{id}/read   — mark one as read
POST  /api/v1/notifications/mark-all-read — mark all as read
"""
from fastapi import APIRouter, Depends, HTTPException, Query

from ..auth.dependencies import get_current_user
from ..db.base import NotificationRepository
from ..db.dependencies import get_notification_repo

router = APIRouter()


@router.get("/notifications")
async def list_notifications(
    unread_only: bool = Query(False),
    current_user: dict = Depends(get_current_user),
    repo: NotificationRepository = Depends(get_notification_repo),
):
    return await repo.find_by_user(current_user["user_id"], unread_only=unread_only)


@router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
    repo: NotificationRepository = Depends(get_notification_repo),
):
    updated = await repo.mark_read(notification_id)
    if updated is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    return updated


@router.post("/notifications/mark-all-read")
async def mark_all_read(
    current_user: dict = Depends(get_current_user),
    repo: NotificationRepository = Depends(get_notification_repo),
):
    count = await repo.mark_all_read(current_user["user_id"])
    return {"updated": count}
