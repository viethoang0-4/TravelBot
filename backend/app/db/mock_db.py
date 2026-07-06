"""
JSON file-based mock repositories — no external DB required.

Files are stored in backend/data/*.json.
Replace with SQLAlchemy implementations when a real DB is available.
"""
import json
import asyncio
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

from .base import ItineraryRepository, UserRepository, NotificationRepository

_DATA_DIR = Path(__file__).parent.parent.parent / "data"
_DATA_DIR.mkdir(exist_ok=True)

_ITINERARIES_FILE = _DATA_DIR / "itineraries.json"
_USERS_FILE = _DATA_DIR / "users.json"
_NOTIFICATIONS_FILE = _DATA_DIR / "notifications.json"

_itinerary_lock = asyncio.Lock()
_user_lock = asyncio.Lock()
_notification_lock = asyncio.Lock()


def _read_json(path: Path) -> list:
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []


def _write_json(path: Path, data: list) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


# ---------------------------------------------------------------------------
# Itinerary
# ---------------------------------------------------------------------------

class MockItineraryRepository(ItineraryRepository):
    async def save(self, itinerary: dict) -> dict:
        async with _itinerary_lock:
            records = _read_json(_ITINERARIES_FILE)
            records = [r for r in records if r.get("itinerary_id") != itinerary.get("itinerary_id")]
            records.append(itinerary)
            _write_json(_ITINERARIES_FILE, records)
        return itinerary

    async def find_all(self) -> list[dict]:
        records = _read_json(_ITINERARIES_FILE)
        return [_summary(r) for r in records]

    async def find_by_id(self, itinerary_id: str) -> Optional[dict]:
        for r in _read_json(_ITINERARIES_FILE):
            if r.get("itinerary_id") == itinerary_id:
                return r
        return None

    async def find_by_user(self, user_id: str) -> list[dict]:
        return [r for r in _read_json(_ITINERARIES_FILE) if r.get("user_id") == user_id]

    async def delete(self, itinerary_id: str) -> bool:
        async with _itinerary_lock:
            records = _read_json(_ITINERARIES_FILE)
            new_records = [r for r in records if r.get("itinerary_id") != itinerary_id]
            if len(new_records) == len(records):
                return False
            _write_json(_ITINERARIES_FILE, new_records)
        return True


def _summary(r: dict) -> dict:
    return {
        "itinerary_id": r.get("itinerary_id"),
        "title": r.get("title"),
        "destination": r.get("destination"),
        "start_date": r.get("start_date"),
        "end_date": r.get("end_date"),
        "summary": r.get("summary"),
        "budget": r.get("budget"),
        "meta": r.get("meta"),
        "user_id": r.get("user_id"),
    }


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class MockUserRepository(UserRepository):
    async def find_or_create(self, user_id: str) -> dict:
        async with _user_lock:
            users = _read_json(_USERS_FILE)
            for u in users:
                if u.get("user_id") == user_id:
                    return u
            new_user = {"user_id": user_id, "preferences": {}, "itinerary_ids": []}
            users.append(new_user)
            _write_json(_USERS_FILE, users)
        return new_user

    async def find_by_google_sub(self, google_sub: str) -> Optional[dict]:
        for u in _read_json(_USERS_FILE):
            if u.get("google_sub") == google_sub or u.get("user_id") == google_sub:
                return u
        return None

    async def find_or_create_by_google(self, google_data: dict) -> dict:
        """google_data keys: sub, email, name, picture."""
        async with _user_lock:
            users = _read_json(_USERS_FILE)
            sub = google_data["sub"]
            for u in users:
                if u.get("google_sub") == sub or u.get("user_id") == sub:
                    # Update profile info in case it changed
                    u["name"] = google_data.get("name", u.get("name", ""))
                    u["avatar_url"] = google_data.get("picture", u.get("avatar_url"))
                    u["email"] = google_data.get("email", u.get("email", ""))
                    _write_json(_USERS_FILE, users)
                    return u
            new_user = {
                "user_id": sub,
                "google_sub": sub,
                "email": google_data.get("email", ""),
                "name": google_data.get("name", ""),
                "avatar_url": google_data.get("picture"),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "preferences": {},
                "itinerary_ids": [],
            }
            users.append(new_user)
            _write_json(_USERS_FILE, users)
        return new_user

    async def list_all(self) -> list[dict]:
        return _read_json(_USERS_FILE)

    async def update_preferences(self, user_id: str, preferences: dict) -> dict:
        async with _user_lock:
            users = _read_json(_USERS_FILE)
            for u in users:
                if u.get("user_id") == user_id:
                    u.setdefault("preferences", {}).update(preferences)
                    _write_json(_USERS_FILE, users)
                    return u
            new_user = {"user_id": user_id, "preferences": preferences, "itinerary_ids": []}
            users.append(new_user)
            _write_json(_USERS_FILE, users)
        return new_user


# ---------------------------------------------------------------------------
# Notification
# ---------------------------------------------------------------------------

class MockNotificationRepository(NotificationRepository):
    async def save(self, notification: dict) -> dict:
        async with _notification_lock:
            records = _read_json(_NOTIFICATIONS_FILE)
            records.append(notification)
            _write_json(_NOTIFICATIONS_FILE, records)
        return notification

    async def find_by_user(self, user_id: str, unread_only: bool = False) -> list[dict]:
        records = _read_json(_NOTIFICATIONS_FILE)
        result = [r for r in records if r.get("user_id") == user_id]
        if unread_only:
            result = [r for r in result if not r.get("read", False)]
        # Newest first
        result.sort(key=lambda r: r.get("created_at", ""), reverse=True)
        return result[:50]  # cap at 50

    async def mark_read(self, notification_id: str) -> Optional[dict]:
        async with _notification_lock:
            records = _read_json(_NOTIFICATIONS_FILE)
            for r in records:
                if r.get("notification_id") == notification_id:
                    r["read"] = True
                    _write_json(_NOTIFICATIONS_FILE, records)
                    return r
        return None

    async def mark_all_read(self, user_id: str) -> int:
        async with _notification_lock:
            records = _read_json(_NOTIFICATIONS_FILE)
            count = 0
            for r in records:
                if r.get("user_id") == user_id and not r.get("read", False):
                    r["read"] = True
                    count += 1
            if count:
                _write_json(_NOTIFICATIONS_FILE, records)
        return count

    async def exists_for_activity(self, user_id: str, activity_id: str, title: str) -> bool:
        for r in _read_json(_NOTIFICATIONS_FILE):
            if (
                r.get("user_id") == user_id
                and r.get("activity_id") == activity_id
                and r.get("title") == title
            ):
                return True
        return False

    async def list_pending_email(self, within_hours: int = 48, limit: int = 50) -> list[dict]:
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=within_hours)).isoformat()
        pending = [
            r for r in _read_json(_NOTIFICATIONS_FILE)
            if r.get("email_sent") is False and r.get("created_at", "") >= cutoff
        ]
        pending.sort(key=lambda r: r.get("created_at", ""))  # oldest first
        return pending[:limit]

    async def mark_email_sent(self, notification_ids: list[str]) -> int:
        if not notification_ids:
            return 0
        ids = set(notification_ids)
        async with _notification_lock:
            records = _read_json(_NOTIFICATIONS_FILE)
            count = 0
            for r in records:
                if r.get("notification_id") in ids and r.get("email_sent") is False:
                    r["email_sent"] = True
                    count += 1
            if count:
                _write_json(_NOTIFICATIONS_FILE, records)
        return count
