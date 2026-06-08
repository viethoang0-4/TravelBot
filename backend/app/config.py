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
    app_name: str = "TravelBot API"
    debug: bool = False
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # LLM model name — override to switch models
    gemini_model: str = "gemini-3-flash-preview"

    # Multi-agent LLM routing — each agent picks a "fast" or "strong" tier.
    # Change provider/model freely (google | anthropic | openai).
    llm_fast_provider: str = "google"
    llm_fast_model: str = "gemini-3-flash-preview"
    llm_strong_provider: str = "google"
    llm_strong_model: str = "gemini-3-flash-preview"

    # Provider API keys (only fill the ones you use)
    anthropic_api_key: str = ""
    openai_api_key: str = ""

    # Reflection loop: how many times the Critic can send the plan back to the Planner
    max_reflection_loops: int = 2

    # Auth — JWT
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expires_hours: int = 24 * 7

    # Auth — Google OAuth
    google_client_id: str = ""
    frontend_url: str = "http://localhost:3000"

    # Email — Gmail SMTP
    gmail_user: str = ""
    gmail_app_password: str = ""
    email_from_name: str = "TravelBot Alert"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
