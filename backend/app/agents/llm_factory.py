"""
Multi-provider LLM factory.

Mỗi agent xin model bằng TÊN AGENT ("supervisor", "planner", ...); module này
tra cứu model riêng của agent đó trong config (LLM_<AGENT>_MODEL), nếu để trống
thì dùng LLM_DEFAULT_MODEL. Provider lấy từ LLM_PROVIDER (mặc định openai = ckey.vn).
Đổi model cho một agent chỉ cần sửa .env — không đụng code agent.
"""
from functools import lru_cache

from langchain_core.language_models.chat_models import BaseChatModel

from ..config import get_settings

# Các agent có thể cấu hình model riêng.
AGENTS = ("supervisor", "clarify", "research", "planner", "critic", "presenter", "chat")


def _build(provider: str, model: str, streaming: bool) -> BaseChatModel:
    settings = get_settings()
    provider = provider.lower().strip()
    timeout = settings.llm_timeout_seconds  # chặn treo vô hạn (vd proxy chậm/runaway)

    if provider == "google":
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model=model,
            google_api_key=settings.gemini_api_key,
            streaming=streaming,
            timeout=timeout,
        )
    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(
            model=model,
            api_key=settings.anthropic_api_key,
            streaming=streaming,
            timeout=timeout,
        )
    if provider == "openai":
        from langchain_openai import ChatOpenAI
        kwargs: dict = {}
        if settings.openai_base_url:
            kwargs["base_url"] = settings.openai_base_url  # proxy OpenAI-compatible (vd ckey.vn)
        return ChatOpenAI(
            model=model,
            api_key=settings.openai_api_key,
            streaming=streaming,
            timeout=timeout,
            max_retries=1,
            **kwargs,
        )
    raise ValueError(f"Unknown LLM provider: {provider!r} (expected google|anthropic|openai)")


def provider_for(agent: str) -> str:
    """Provider cho agent (override riêng `LLM_<AGENT>_PROVIDER` nếu có, không thì mặc định)."""
    settings = get_settings()
    return getattr(settings, f"llm_{agent}_provider", "") or settings.llm_provider


def model_for(agent: str) -> str:
    """Tên model dành cho agent (override riêng nếu có, không thì model mặc định)."""
    settings = get_settings()
    return getattr(settings, f"llm_{agent}_model", "") or settings.llm_default_model


@lru_cache(maxsize=16)
def get_chat_model(agent: str = "chat", streaming: bool = False) -> BaseChatModel:
    """Chat model (cached) cho một agent. Provider + model lấy từ config (có thể đặt riêng/agent)."""
    return _build(provider_for(agent), model_for(agent), streaming)
