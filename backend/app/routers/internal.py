"""
Internal endpoints triggered by an EXTERNAL scheduler (GitHub Actions cron / cron-job.org).

Trên host free (HF Spaces) container "ngủ" khi không có traffic nên APScheduler in-process
không chạy đều → thay bằng cron ngoài gọi định kỳ vào đây. Đồng thời mỗi lần gọi cũng
"đánh thức" service (chống cold start cho người dùng kế tiếp).

Bảo vệ bằng header bí mật X-Internal-Secret == INTERNAL_API_SECRET (không phải JWT người dùng).
"""
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from ..config import get_settings
from ..db.dependencies import get_notification_repo
from ..services.scheduler import weather_check_job

router = APIRouter()


def _check_secret(x_internal_secret: str | None) -> None:
    secret = get_settings().internal_api_secret
    if not secret:
        # Chưa cấu hình bí mật -> khoá an toàn, không cho chạy job.
        raise HTTPException(status_code=503, detail="Internal scheduler not configured")
    if x_internal_secret != secret:
        raise HTTPException(status_code=403, detail="Forbidden")


@router.post("/internal/weather-check")
async def run_weather_check(x_internal_secret: str | None = Header(default=None)):
    _check_secret(x_internal_secret)
    result = await weather_check_job()
    # emails: HF Spaces chặn SMTP outbound -> cron (GitHub Actions) nhận danh sách này,
    # gửi hộ từ runner bằng Gmail SMTP rồi gọi /internal/mark-emails-sent báo lại.
    # Thông báo vẫn ở email_sent=False cho tới khi được báo đã gửi -> không mất email.
    return {
        "status": "ok",
        "alerts": result["total_alerts"],
        "emails": result["pending_emails"],
    }


class MarkEmailsSentBody(BaseModel):
    notification_ids: list[str] = []


@router.post("/internal/mark-emails-sent")
async def mark_emails_sent(
    body: MarkEmailsSentBody,
    x_internal_secret: str | None = Header(default=None),
):
    """Cron gọi lại sau khi gửi thành công để đánh dấu các thông báo đã gửi email."""
    _check_secret(x_internal_secret)
    updated = await get_notification_repo().mark_email_sent(body.notification_ids)
    return {"status": "ok", "marked": updated}
