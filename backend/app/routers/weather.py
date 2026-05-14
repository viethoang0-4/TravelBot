"""
Weather endpoints.

GET  /api/v1/weather/forecast?lat=&lng=  — one-shot forecast check
POST /api/v1/weather/check-now           — trigger weather job for current user (debug)
"""
from fastapi import APIRouter, Depends, Query

from ..auth.dependencies import get_current_user
from ..db.base import ItineraryRepository
from ..db.dependencies import get_itinerary_repo
from ..services import weather as weather_svc
from ..services import alerts as alert_svc

router = APIRouter()


@router.get("/weather/forecast")
async def get_forecast(
    lat: float = Query(...),
    lng: float = Query(...),
    current_user: dict = Depends(get_current_user),
):
    forecast = await weather_svc.get_forecast(lat, lng)
    if forecast is None:
        return {"error": "Weather API unavailable or key not configured"}
    slots = forecast.get("list", [])[:8]  # next 24h
    return {
        "city": forecast.get("city", {}).get("name"),
        "slots": [
            {
                "dt": s["dt"],
                "weather": s.get("weather", [{}])[0].get("description"),
                "temp": s.get("main", {}).get("temp"),
                "wind_speed": s.get("wind", {}).get("speed"),
            }
            for s in slots
        ],
    }


@router.post("/weather/check-now")
async def trigger_weather_check(
    current_user: dict = Depends(get_current_user),
    itinerary_repo: ItineraryRepository = Depends(get_itinerary_repo),
):
    """Manually trigger weather check for current user's itineraries. Useful for testing."""
    itineraries = await itinerary_repo.find_by_user(current_user["user_id"])
    total_alerts = 0
    results = []

    for itin in itineraries:
        new_alerts = await alert_svc.check_itinerary(current_user, itin)
        if new_alerts:
            await alert_svc.dispatch_alerts(current_user, itin, new_alerts)
        total_alerts += len(new_alerts)
        results.append({
            "itinerary_id": itin.get("itinerary_id"),
            "title": itin.get("title"),
            "new_alerts": len(new_alerts),
        })

    return {
        "checked": len(itineraries),
        "total_new_alerts": total_alerts,
        "itineraries": results,
    }
