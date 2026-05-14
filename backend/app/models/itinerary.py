from pydantic import BaseModel
from typing import Optional


class Location(BaseModel):
    name: str
    address: Optional[str] = None
    lat: float
    lng: float
    place_id: Optional[str] = None


class Activity(BaseModel):
    id: str
    time: str
    duration_minutes: int
    type: str  # transport | accommodation | food | activity | shopping | rest
    title: str
    description: str
    location: Location
    cost_estimate: float
    tips: Optional[str] = None
    booking_url: Optional[str] = None
    is_hidden_gem: bool = False
    weather_sensitive: bool = False
    tags: list[str] = []
    image_url: Optional[str] = None


class DayPlan(BaseModel):
    day: int
    date: str
    theme: str
    activities: list[Activity]


class BudgetBreakdown(BaseModel):
    accommodation: float
    transport: float
    food: float
    activities: float
    misc: float


class Budget(BaseModel):
    total_estimated: float
    currency: str = "VND"
    breakdown: BudgetBreakdown


class HiddenGem(BaseModel):
    id: str
    name: str
    description: str
    location: Location
    source: str
    confidence_score: float


class ItineraryMeta(BaseModel):
    generated_by: str
    model_used: str
    generated_at: str
    version: int


class Itinerary(BaseModel):
    itinerary_id: str
    title: str
    destination: str
    start_date: str
    end_date: str
    summary: str
    budget: Budget
    days: list[DayPlan]
    hidden_gems: list[HiddenGem] = []
    meta: ItineraryMeta
