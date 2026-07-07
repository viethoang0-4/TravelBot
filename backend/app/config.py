from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Required
    gemini_api_key: str = ""

    # Optional - enhanced features
    tavily_api_key: str = ""
    openweather_api_key: str = ""

    # Database: leave empty to use the JSON mock DB
    database_url: str = ""

    # App
    app_name: str = "Compasso API"
    debug: bool = False
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # LLM model name cho baseline single-LLM node (eval) — override để đổi model
    gemini_model: str = "gemini-3-flash-preview"

    # ── LLM cho multi-agent — mặc định ckey.vn (OpenAI-compatible proxy) ──
    # Chỉ cần MỘT api key: OPENAI_API_KEY = key ckey.vn, OPENAI_BASE_URL = endpoint ckey.
    # Đổi model cho 1 agent = set LLM_<AGENT>_MODEL; để trống = dùng LLM_DEFAULT_MODEL.
    llm_provider: str = "google"            # google | anthropic | openai (=ckey)
    llm_default_model: str = "gemini-3-flash-preview"
    llm_timeout_seconds: int = 120          # chặn call treo vô hạn (proxy chậm/runaway)

    # Model riêng cho từng agent (để trống = LLM_DEFAULT_MODEL)
    llm_supervisor_model: str = ""
    llm_clarify_model: str = ""
    llm_research_model: str = ""
    llm_planner_model: str = ""
    llm_critic_model: str = ""
    llm_presenter_model: str = ""
    llm_chat_model: str = ""

    # Provider riêng cho từng agent (để trống = LLM_PROVIDER). Cho phép định tuyến hỗn hợp
    # (vd để chat/presenter dùng ckey còn lại Gemini) — mặc định tất cả theo LLM_PROVIDER.
    llm_supervisor_provider: str = ""
    llm_clarify_provider: str = ""
    llm_research_provider: str = ""
    llm_planner_provider: str = ""
    llm_critic_provider: str = ""
    llm_presenter_provider: str = ""
    llm_chat_provider: str = ""

    # Provider API keys (chỉ điền cái bạn dùng; OPENAI_API_KEY = key ckey.vn)
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    openai_base_url: str = ""   # endpoint OpenAI-compatible (ckey.vn). Trống → OpenAI gốc.

    # Reflection loop: how many times the Critic can send the plan back to the Planner.
    # 1 = tối đa 1 lượt sửa, và chỉ khi có vấn đề KHÁCH QUAN (xem _route_after_critic) →
    # cắt thời gian + quota cho phần lớn request mà vẫn tự-sửa khi thật sự bất khả thi.
    max_reflection_loops: int = 1

    # ── Goong Maps REST (grounding: neo tọa độ THẬT + tuyến đường/thời gian THẬT) ──
    # Chống ảo giác địa lý: planner LLM "đoán" lat/lng → thay bằng tọa độ thật của Goong,
    # và tính tuyến đường + thời gian di chuyển thật (thay haversine) qua Goong Directions.
    # LƯU Ý: đây là REST API key (rsapi.goong.io) — KHÁC Maptiles key của frontend.
    goong_api_key: str = ""
    grounding_enabled: bool = True
    grounding_vehicle: str = "car"   # car | bike | taxi | truck (Goong Directions)

    # ── Social experiences — review thật từ web (Tavily) + vlog YouTube ──
    # KHÔNG dùng vector DB/embedding: tìm trực tiếp khi lập kế hoạch để giữ tốc độ.
    social_enabled: bool = True
    # YouTube TẮT mặc định cho nhanh; code connector vẫn còn (bật lại = true).
    # Xem backend/docs/social-search.md để biết lý do + cách mô tả trong báo cáo.
    social_youtube_enabled: bool = False
    youtube_api_key: str = ""        # YouTube Data API v3 (vlog + transcript)
    social_max_videos: int = 3       # số vlog YouTube lấy transcript mỗi chuyến
    social_max_web_results: int = 5  # số review web (Tavily) mỗi chuyến

    # Auth — JWT
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    # Khớp với session NextAuth (mặc định 30 ngày) để token backend không chết
    # trước session → tránh 401 "Invalid token" khi session vẫn còn sống.
    jwt_expires_hours: int = 24 * 30

    # Auth — Google OAuth
    google_client_id: str = ""
    frontend_url: str = "http://localhost:3000"

    # Email — Gmail SMTP
    gmail_user: str = ""
    gmail_app_password: str = ""
    email_from_name: str = "Compasso Alert"
    # HF Spaces chặn MỌI cổng outbound trừ 80/443/8080 → không gửi SMTP trực tiếp được.
    # Đặt EMAIL_DIRECT_SEND=false (Dockerfile đã đặt): backend trả danh sách email chờ
    # gửi qua /internal/weather-check để cron GitHub Actions gửi hộ từ runner.
    email_direct_send: bool = True

    # ── Triển khai (deploy) ──────────────────────────────────────────────
    # Production trên host free (HF Spaces) "ngủ" khi không có traffic → APScheduler
    # in-process không chạy ổn định. Đặt SCHEDULER_ENABLED=false và để cron NGOÀI
    # (GitHub Actions) gọi POST /api/v1/internal/weather-check mỗi giờ.
    scheduler_enabled: bool = True
    # Bí mật bảo vệ endpoint cron nội bộ (cron gửi header X-Internal-Secret).
    # Để trống → endpoint trả 503 (khoá an toàn, không chạy job).
    internal_api_secret: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
