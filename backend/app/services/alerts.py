"""
Weather alert detection and dispatch.

Uses OpenWeather free-tier forecast (5-day, 3-hour intervals).
Detects severe conditions for upcoming weather-sensitive activities.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional

from . import weather as weather_svc
from . import email as email_svc
from ..db.base import NotificationRepository
from ..db.dependencies import get_notification_repo

_CONDITION_LABELS = {
    "thunderstorm": "Dông sét",
    "heavy_rain": "Mưa lớn",
    "snow": "Tuyết rơi",
    "strong_wind": "Gió mạnh",
}


async def check_itinerary(user: dict, itinerary: dict) -> list[dict]:
    """
    Check all upcoming activities in an itinerary for severe weather.
    Returns list of alert dicts that were newly created.
    """
    notification_repo = get_notification_repo()
    alerts_created: list[dict] = []

    days = itinerary.get("days", [])
    if not days:
        return []

    # Collect unique lat/lng combos to fetch forecasts
    coord_forecasts: dict[str, Optional[dict]] = {}
    today = datetime.now(timezone.utc).date()

    for day in days:
        day_date_str = day.get("date", "")
        try:
            day_date = datetime.strptime(day_date_str, "%Y-%m-%d").date()
        except ValueError:
            continue

        # Only check activities within the next 7 days
        delta = (day_date - today).days
        if delta < 0 or delta > 7:
            continue

        for activity in day.get("activities", []):
            # Check weather_sensitive activities OR outdoor types
            is_outdoor = activity.get("type") in ("activity", "transport")
            if not activity.get("weather_sensitive") and not is_outdoor:
                continue

            location = activity.get("location", {})
            lat = location.get("lat")
            lng = location.get("lng")
            if not lat or not lng:
                continue

            coord_key = f"{lat},{lng}"
            if coord_key not in coord_forecasts:
                coord_forecasts[coord_key] = await weather_svc.get_forecast(lat, lng)

            forecast = coord_forecasts[coord_key]
            if not forecast:
                continue

            # Parse activity datetime
            time_str = activity.get("time", "08:00")
            try:
                activity_dt = datetime(
                    day_date.year, day_date.month, day_date.day,
                    int(time_str[:2]), int(time_str[3:5]),
                    tzinfo=timezone.utc
                )
            except (ValueError, IndexError):
                continue

            slot = weather_svc.get_forecast_for_datetime(forecast, activity_dt)
            if not slot:
                continue

            weather_id = slot.get("weather", [{}])[0].get("id", 800)
            wind_speed = slot.get("wind", {}).get("speed", 0)
            severe, condition_name = weather_svc.is_severe(weather_id, wind_speed)

            if not severe:
                continue

            condition_label = _CONDITION_LABELS.get(condition_name, condition_name)
            title = f"⚠️ Cảnh báo thời tiết: {condition_label} tại {activity.get('title', '')}"
            body = (
                f"Ngày {day_date_str} lúc {time_str} — "
                f"{activity.get('title', 'Hoạt động')} ({location.get('name', '')}) "
                f"dự báo có {condition_label.lower()}. "
                f"Hãy kiểm tra lại kế hoạch của bạn."
            )

            # Dedup: skip if already notified for same activity + condition
            activity_id = activity.get("id", "")
            already_sent = await notification_repo.exists_for_activity(
                user["user_id"], activity_id, title
            )
            if already_sent:
                continue

            notification = await _create_notification(
                notification_repo,
                user_id=user["user_id"],
                itinerary_id=itinerary.get("itinerary_id"),
                activity_id=activity_id,
                title=title,
                body=body,
                severity="critical" if condition_name == "thunderstorm" else "warning",
            )
            alerts_created.append(notification)

    return alerts_created


async def _create_notification(
    repo: NotificationRepository,
    user_id: str,
    itinerary_id: Optional[str],
    activity_id: str,
    title: str,
    body: str,
    severity: str,
) -> dict:
    import uuid
    notification = {
        "notification_id": str(uuid.uuid4()),
        "user_id": user_id,
        "itinerary_id": itinerary_id,
        "activity_id": activity_id,
        "title": title,
        "body": body,
        "severity": severity,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read": False,
    }
    return await repo.save(notification)


async def dispatch_alerts(user: dict, itinerary: dict, alerts: list[dict]) -> None:
    """Send email for a batch of alerts."""
    if not alerts:
        return
    await email_svc.send_weather_alert(user, itinerary, alerts)
