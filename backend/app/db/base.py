"""
Abstract repository interfaces.

Swap the mock implementation for a real SQLAlchemy/PostgreSQL one by
creating a class that inherits from these ABCs and updating
app/db/dependencies.py to inject it instead.
"""
from abc import ABC, abstractmethod
from typing import Optional


class ItineraryRepository(ABC):
    @abstractmethod
    async def save(self, itinerary: dict) -> dict:
        """Persist an itinerary and return it (with any DB-assigned fields)."""
        ...

    @abstractmethod
    async def find_all(self) -> list[dict]:
        """Return all saved itineraries (summary fields only for list views)."""
        ...

    @abstractmethod
    async def find_by_id(self, itinerary_id: str) -> Optional[dict]:
        """Return a single itinerary by its ID, or None if not found."""
        ...

    @abstractmethod
    async def find_by_user(self, user_id: str) -> list[dict]:
        """Return all itineraries belonging to a specific user."""
        ...

    @abstractmethod
    async def delete(self, itinerary_id: str) -> bool:
        """Delete an itinerary. Returns True if deleted, False if not found."""
        ...


class UserRepository(ABC):
    @abstractmethod
    async def find_or_create(self, user_id: str) -> dict:
        """Return existing user or create a new one."""
        ...

    @abstractmethod
    async def find_by_google_sub(self, google_sub: str) -> Optional[dict]:
        """Return user by Google sub (user_id), or None."""
        ...

    @abstractmethod
    async def find_or_create_by_google(self, google_data: dict) -> dict:
        """Upsert user from Google OAuth payload. google_data: {sub, email, name, picture}."""
        ...

    @abstractmethod
    async def list_all(self) -> list[dict]:
        """Return all users (for scheduler iteration)."""
        ...

    @abstractmethod
    async def update_preferences(self, user_id: str, preferences: dict) -> dict:
        """Merge preferences into the user record."""
        ...


class NotificationRepository(ABC):
    @abstractmethod
    async def save(self, notification: dict) -> dict:
        """Persist a notification."""
        ...

    @abstractmethod
    async def find_by_user(self, user_id: str, unread_only: bool = False) -> list[dict]:
        """Return notifications for a user, newest first."""
        ...

    @abstractmethod
    async def mark_read(self, notification_id: str) -> Optional[dict]:
        """Mark a notification as read. Returns updated notification or None."""
        ...

    @abstractmethod
    async def mark_all_read(self, user_id: str) -> int:
        """Mark all unread notifications for user as read. Returns count updated."""
        ...

    @abstractmethod
    async def exists_for_activity(self, user_id: str, activity_id: str, title: str) -> bool:
        """Check if a similar notification was already sent (dedup)."""
        ...
