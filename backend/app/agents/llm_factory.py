"""
Multi-provider LLM factory.

Each agent asks for a logical tier ("fast" or "strong"); this module maps the
tier to a concrete provider + model via config, so you can swap Gemini / Claude /
OpenAI just by editing .env — no agent code changes.
"""
from functools import lru_cache
from typing import Literal

from langchain_core.language_models.chat_models import BaseChatModel

from ..config import get_settings

Tier = Literal["fast", "strong"]


def _build(provider: str, model: str, streaming: bool) -> BaseChatModel:
    settings = get_settings()
    provider = provider.lower().strip()

    if provider == "google":
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model=model,
            google_api_key=settings.gemini_api_key,
            streaming=streaming,
        )
    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(
            model=model,
            api_key=settings.anthropic_api_key,
            streaming=streaming,
        )
    if provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=model,
            api_key=settings.openai_api_key,
            streaming=streaming,
        )
    raise ValueError(f"Unknown LLM provider: {provider!r} (expected google|anthropic|openai)")


@lru_cache(maxsize=8)
def get_chat_model(tier: Tier = "fast", streaming: bool = False) -> BaseChatModel:
    """Return a cached chat model for the given tier. Provider/model come from config."""
    settings = get_settings()
    if tier == "strong":
        return _build(settings.llm_strong_provider, settings.llm_strong_model, streaming)
    return _build(settings.llm_fast_provider, settings.llm_fast_model, streaming)
