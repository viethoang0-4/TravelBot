"""
Internal endpoints triggered by an EXTERNAL scheduler (GitHub Actions cron / cron-job.org).

Trên host free (HF Spaces) container "ngủ" khi không có traffic nên APScheduler in-process
không chạy đều → thay bằng cron ngoài gọi định kỳ vào đây. Đồng thời mỗi lần gọi cũng
"đánh thức" service (chống cold start cho người dùng kế tiếp).

Bảo vệ bằng header bí mật X-Internal-Secret == INTERNAL_API_SECRET (không phải JWT người dùng).
"""
from fastapi import APIRouter, Header, HTTPException

from ..config import get_settings
from ..services.scheduler import weather_check_job

router = APIRouter()


@router.post("/internal/weather-check")
async def run_weather_check(x_internal_secret: str | None = Header(default=None)):
    secret = get_settings().internal_api_secret
    if not secret:
        # Chưa cấu hình bí mật → khoá an toàn, không cho chạy job.
        raise HTTPException(status_code=503, detail="Internal scheduler not configured")
    if x_internal_secret != secret:
        raise HTTPException(status_code=403, detail="Forbidden")
    await weather_check_job()
    return {"status": "ok"}
