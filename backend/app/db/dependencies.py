"""
FastAPI dependency injection for repositories.

Backend storage is chosen by the DATABASE_URL setting:
- empty  → JSON file mock (backend/data/*.json), zero setup
- set    → real PostgreSQL via async SQLAlchemy (app/db/sql_db.py)

Everything else depends only on the abstract base.*Repository interfaces, so
nothing else changes when you switch.
"""
from ..config import get_settings
from .base import ItineraryRepository, UserRepository, NotificationRepository

_settings = get_settings()

if _settings.database_url:
    from .sql_db import (
        SqlItineraryRepository,
        SqlUserRepository,
        SqlNotificationRepository,
    )

    _itinerary_repo: ItineraryRepository = SqlItineraryRepository()
    _user_repo: UserRepository = SqlUserRepository()
    _notification_repo: NotificationRepository = SqlNotificationRepository()
else:
    from .mock_db import (
        MockItineraryRepository,
        MockUserRepository,
        MockNotificationRepository,
    )

    _itinerary_repo = MockItineraryRepository()
    _user_repo = MockUserRepository()
    _notification_repo = MockNotificationRepository()


def get_itinerary_repo() -> ItineraryRepository:
    return _itinerary_repo


def get_user_repo() -> UserRepository:
    return _user_repo


def get_notification_repo() -> NotificationRepository:
    return _notification_repo
