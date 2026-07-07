from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from .config import get_settings
from .limiter import limiter
from .routers import chat, itineraries, auth, notifications, weather, users, internal
from .services.scheduler import start_scheduler, stop_scheduler

settings = get_settings()

# Origins được phép gọi API: danh sách cấu hình + URL frontend production (gộp, khử trùng).
# Trên Vercel chỉ cần set FRONTEND_URL=https://<app>.vercel.app là CORS tự đúng.
_cors_origins = list(dict.fromkeys([*settings.cors_origins, settings.frontend_url]))


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.database_url:
        from .db.sql_db import init_db
        await init_db()  # create tables if they don't exist
    # Trên host free (ngủ khi rảnh) tắt scheduler in-process, dùng cron ngoài (xem routers/internal.py)
    if settings.scheduler_enabled:
        start_scheduler()
    yield
    if settings.scheduler_enabled:
        stop_scheduler()


app = FastAPI(
    title=settings.app_name,
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

# Rate limit (chống gọi API quá nhiều / lạm dụng) — key theo IP thật (X-Forwarded-For sau proxy HF).
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# CORS thêm SAU cùng → là middleware NGOÀI CÙNG, để cả response 429 (rate limit) vẫn kèm header CORS
# (nếu không, trình duyệt chặn và frontend không đọc được thông báo lỗi).
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1", tags=["auth"])
app.include_router(users.router, prefix="/api/v1", tags=["users"])
app.include_router(chat.router, prefix="/api/v1", tags=["chat"])
app.include_router(itineraries.router, prefix="/api/v1", tags=["itineraries"])
app.include_router(notifications.router, prefix="/api/v1", tags=["notifications"])
app.include_router(weather.router, prefix="/api/v1", tags=["weather"])
app.include_router(internal.router, prefix="/api/v1", tags=["internal"])


@app.get("/api/v1/health", tags=["health"])
async def health():
    return {
        "status": "ok",
        "version": "2.0.0",
        "model": settings.gemini_model,
        "db": "mock" if not settings.database_url else "postgresql",
        "auth": "google_oauth",
        "weather": "openweather_free_tier",
    }
