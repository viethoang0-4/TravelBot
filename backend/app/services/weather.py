"""
OpenWeather free-tier wrapper.
Uses /data/2.5/forecast (5-day, 3-hour intervals) — no One Call subscription needed.
"""
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import httpx

from ..config import get_settings

_DATA_DIR = Path(__file__).parent.parent.parent / "data"
_CACHE_FILE = _DATA_DIR / "forecast_cache.json"

# In-memory cache for coord → forecast (TTL 30 min)
_coord_cache: dict[str, tuple[float, dict]] = {}  # key → (timestamp, data)
_COORD_CACHE_TTL = 30 * 60  # 30 minutes

# Severe weather condition IDs (OpenWeather codes)
_THUNDERSTORM = range(200, 233)
_HEAVY_RAIN = range(502, 532)
_SNOW = range(600, 623)
_WIND_THRESHOLD_MS = 10.0


def _cache_key(lat: float, lng: float) -> str:
    return f"{round(lat, 3)},{round(lng, 3)}"


def _read_file_cache() -> dict:
    if not _CACHE_FILE.exists():
        return {}
    try:
        return json.loads(_CACHE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _write_file_cache(data: dict) -> None:
    try:
        _CACHE_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass


async def get_forecast(lat: float, lng: float) -> Optional[dict]:
    """Fetch 5-day forecast from OpenWeather free tier. Returns raw API response or None."""
    settings = get_settings()
    if not settings.openweather_api_key:
        return None

    key = _cache_key(lat, lng)
    now = time.time()

    # Check in-memory cache
    if key in _coord_cache:
        ts, data = _coord_cache[key]
        if now - ts < _COORD_CACHE_TTL:
            return data

    url = "https://api.openweathermap.org/data/2.5/forecast"
    params = {
        "lat": lat,
        "lon": lng,
        "appid": settings.openweather_api_key,
        "units": "metric",
        "lang": "vi",
        "cnt": 40,  # 5 days × 8 slots/day
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            _coord_cache[key] = (now, data)
            return data
    except Exception as exc:
        print(f"[WEATHER] Error fetching forecast ({lat},{lng}): {exc}")
        return None


def is_severe(weather_id: int, wind_speed: float) -> tuple[bool, str]:
    """Returns (is_severe, condition_name)."""
    if weather_id in _THUNDERSTORM:
        return True, "thunderstorm"
    if weather_id in _HEAVY_RAIN:
        return True, "heavy_rain"
    if weather_id in _SNOW:
        return True, "snow"
    if wind_speed >= _WIND_THRESHOLD_MS:
        return True, "strong_wind"
    return False, "clear"


def get_forecast_for_datetime(forecast: dict, target_dt: datetime) -> Optional[dict]:
    """Find the forecast slot closest to target_dt (within ±3 hours)."""
    target_ts = target_dt.timestamp()
    best = None
    best_diff = float("inf")

    for slot in forecast.get("list", []):
        diff = abs(slot["dt"] - target_ts)
        if diff < best_diff:
            best_diff = diff
            best = slot

    # Only return if within 6 hours
    if best and best_diff <= 6 * 3600:
        return best
    return None


def get_cached_itinerary_forecast(itinerary_id: str) -> Optional[dict]:
    cache = _read_file_cache()
    return cache.get(itinerary_id)


def update_itinerary_forecast_cache(itinerary_id: str, forecast_snapshot: dict) -> None:
    cache = _read_file_cache()
    cache[itinerary_id] = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "snapshot": forecast_snapshot,
    }
    _write_file_cache(cache)
