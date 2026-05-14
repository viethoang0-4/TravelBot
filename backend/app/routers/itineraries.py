"""
CRUD endpoints for saved itineraries (requires auth, scoped to current user).

GET    /api/v1/itineraries         — list user's itineraries (summary fields)
GET    /api/v1/itineraries/{id}    — get full itinerary
POST   /api/v1/itineraries         — save / upsert an itinerary
DELETE /api/v1/itineraries/{id}    — delete an itinerary
"""
from fastapi import APIRouter, Depends, HTTPException

from ..auth.dependencies import get_current_user
from ..db.base import ItineraryRepository
from ..db.dependencies import get_itinerary_repo

router = APIRouter()


@router.get("/itineraries")
async def list_itineraries(
    current_user: dict = Depends(get_current_user),
    repo: ItineraryRepository = Depends(get_itinerary_repo),
):
    return await repo.find_by_user(current_user["user_id"])


@router.get("/itineraries/{itinerary_id}")
async def get_itinerary(
    itinerary_id: str,
    current_user: dict = Depends(get_current_user),
    repo: ItineraryRepository = Depends(get_itinerary_repo),
):
    item = await repo.find_by_id(itinerary_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Itinerary not found")
    if item.get("user_id") != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    return item


@router.post("/itineraries", status_code=201)
async def save_itinerary(
    itinerary: dict,
    current_user: dict = Depends(get_current_user),
    repo: ItineraryRepository = Depends(get_itinerary_repo),
):
    if not itinerary.get("itinerary_id"):
        raise HTTPException(status_code=422, detail="itinerary_id is required")
    itinerary["user_id"] = current_user["user_id"]
    return await repo.save(itinerary)


@router.delete("/itineraries/{itinerary_id}", status_code=204)
async def delete_itinerary(
    itinerary_id: str,
    current_user: dict = Depends(get_current_user),
    repo: ItineraryRepository = Depends(get_itinerary_repo),
):
    item = await repo.find_by_id(itinerary_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Itinerary not found")
    if item.get("user_id") != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    await repo.delete(itinerary_id)
