"""
Social connectors — lấy review/trải nghiệm thật, tìm TRỰC TIẾP khi lập kế hoạch
(không vector DB). Hai nguồn:

1. Web review qua Tavily — blog/forum/mạng xã hội thật về điểm đến.
2. YouTube vlog + transcript — vlog du lịch tiếng Việt.

Mỗi connector trả list dict {platform, title, text, url, author} và tự degrade về
[] khi thiếu API key / lỗi mạng (luồng lập kế hoạch không bao giờ vỡ).
"""
import asyncio

import httpx

from ...config import get_settings
from .trace import log, trunc

_YT_SEARCH = "https://www.googleapis.com/youtube/v3/search"


# ── 1. Web review qua Tavily ─────────────────────────────────────────────────

async def search_web_reviews(query: str, max_results: int = 5) -> list[dict]:
    settings = get_settings()
    if not settings.tavily_api_key:
        return []
    try:
        from tavily import AsyncTavilyClient
        client = AsyncTavilyClient(api_key=settings.tavily_api_key)
        resp = await client.search(
            query=query,
            max_results=max_results,
            search_depth="basic",
            include_answer=False,
        )
        posts = []
        for r in resp.get("results", []):
            text = (r.get("content", "") or "").strip()
            if text:
                posts.append({
                    "platform": "web",
                    "title": r.get("title", ""),
                    "text": text[:1500],
                    "url": r.get("url", ""),
                    "author": "",
                })
        log(f"[CONNECTOR] web/tavily   q='{query}'  -> {len(posts)} bài")
        for i, p in enumerate(posts):
            log(f"   #{i+1} {p['url']}")
            log(f"        {trunc(p['text'])}")
        return posts
    except Exception as e:
        log(f"[CONNECTOR] web/tavily LỖI q='{query}': {e}")
        return []


# ── 2. YouTube vlog + transcript ─────────────────────────────────────────────

def _fetch_transcript(video_id: str) -> str:
    """Sync (chạy trong to_thread). Trả về transcript nối liền, '' nếu không có."""
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        fetched = YouTubeTranscriptApi().fetch(video_id, languages=["vi", "en"])
        return " ".join(s.text for s in fetched.snippets)
    except Exception:
        return ""


async def search_youtube_experiences(query: str, max_videos: int = 3) -> list[dict]:
    settings = get_settings()
    if not settings.youtube_api_key:
        return []
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(_YT_SEARCH, params={
                "part": "snippet",
                "q": query,
                "type": "video",
                "relevanceLanguage": "vi",
                "regionCode": "VN",
                "maxResults": max_videos,
                "key": settings.youtube_api_key,
            })
            resp.raise_for_status()
            items = resp.json().get("items", [])
    except Exception as e:
        log(f"[CONNECTOR] youtube search LỖI q='{query}': {e}")
        return []

    async def _one(item) -> dict | None:
        vid = (item.get("id") or {}).get("videoId")
        sn = item.get("snippet") or {}
        if not vid:
            return None
        transcript = await asyncio.to_thread(_fetch_transcript, vid)
        # Không có transcript thì vẫn dùng title+description (mỏng nhưng thật).
        # Cắt gọn: planner chỉ cần gợi ý địa điểm/mẹo, không cần cả transcript thô.
        has_tr = bool(transcript)
        body = transcript[:1500] if has_tr else sn.get("description", "")
        text = body.strip()
        if not text:
            return None
        return {
            "platform": "youtube",
            "title": sn.get("title", ""),
            "text": text,
            "url": f"https://www.youtube.com/watch?v={vid}",
            "author": sn.get("channelTitle", ""),
            "_has_transcript": has_tr,
        }

    posts = [p for p in await asyncio.gather(*[_one(i) for i in items]) if p]
    log(f"[CONNECTOR] youtube        q='{query}'  -> {len(posts)} video")
    for i, p in enumerate(posts):
        tr = "transcript" if p.pop("_has_transcript", False) else "mô tả (KHÔNG có transcript)"
        log(f"   #{i+1} @{p['author']} | {tr} {len(p['text'])} ký tự | {p['url']}")
        log(f"        {trunc(p['text'])}")
    return posts


# ── Gom 2 nguồn cho một điểm đến ─────────────────────────────────────────────

async def gather_experiences(destination: str) -> list[dict]:
    """Chạy web (Tavily) [+ YouTube nếu bật] song song; khử trùng lặp theo URL.

    YouTube mặc định TẮT (social_youtube_enabled=False) cho nhanh — connector vẫn
    còn nguyên, bật lại bằng config. Xem backend/docs/social-search.md.
    """
    settings = get_settings()
    tasks = [
        search_web_reviews(
            f"review kinh nghiệm du lịch {destination} ăn gì chơi gì",
            max_results=settings.social_max_web_results,
        ),
    ]
    if settings.social_youtube_enabled:
        tasks.append(search_youtube_experiences(
            f"review du lịch {destination}", max_videos=settings.social_max_videos
        ))
    nested = await asyncio.gather(*tasks)
    posts = [p for sub in nested for p in sub]

    seen: set[str] = set()
    unique = []
    for p in posts:
        key = p.get("url") or p["text"][:80]
        if key in seen:
            continue
        seen.add(key)
        unique.append(p)
    n_web = sum(1 for p in unique if p["platform"] == "web")
    n_yt = sum(1 for p in unique if p["platform"] == "youtube")
    log(f"[GATHER] tổng {len(unique)} bài sau khử trùng lặp (web={n_web}, youtube={n_yt})")
    return unique
