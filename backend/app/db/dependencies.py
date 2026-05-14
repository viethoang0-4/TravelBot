"""
FastAPI dependency injection for repositories.

To switch to a real database:
1. Create PostgreSQL implementations that inherit from base.*Repository
2. Replace the mock instances below with your real implementations.
"""
from .mock_db import MockItineraryRepository, MockUserRepository, MockNotificationRepository
from .base import ItineraryRepository, UserRepository, NotificationRepository

_itinerary_repo = MockItineraryRepository()
_user_repo = MockUserRepository()
_notification_repo = MockNotificationRepository()


def get_itinerary_repo() -> ItineraryRepository:
    return _itinerary_repo


def get_user_repo() -> UserRepository:
    return _user_repo


def get_notification_repo() -> NotificationRepository:
    return _notification_repo
