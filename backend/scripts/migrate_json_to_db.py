"""
One-off migration: import the JSON mock data (backend/data/*.json) into the real
database configured by DATABASE_URL.

Run from the backend/ directory (after `pip install -r requirements.txt` and after
setting DATABASE_URL in .env):

    py -3.13 scripts/migrate_json_to_db.py     (Windows)
    python scripts/migrate_json_to_db.py       (other)

Idempotent: re-running upserts itineraries/users by id and skips notifications
that already exist.
"""
import asyncio
import json
import os
import sys
from pathlib import Path

# Make `app` importable when run as a plain script
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import get_settings  # noqa: E402
from app.db.sql_db import (  # noqa: E402  # noqa: E402
    init_db,
    get_session_factory,
    ItineraryRow,
    UserRow,
    NotificationRow,
)

_DATA_DIR = Path(__file__).parent.parent / "data"


def _read(name: str) -> list:
    path = _DATA_DIR / name
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []


async def main() -> None:
    if not get_settings().database_url:
        print("DATABASE_URL is empty — set it in .env first. Aborting.")
        return

    await init_db()
    Session = get_session_factory()

    itineraries = _read("itineraries.json")
    users = _read("users.json")
    notifications = _read("notifications.json")

    async with Session() as s:
        # Itineraries (upsert by itinerary_id)
        n_it = 0
        for it in itineraries:
            iid = it.get("itinerary_id")
            if not iid:
                continue
            row = await s.get(ItineraryRow, iid)
            if row:
                row.user_id = it.get("user_id")
                row.data = it
            else:
                s.add(ItineraryRow(itinerary_id=iid, user_id=it.get("user_id"), data=it))
            n_it += 1

        # Users (upsert by user_id)
        n_u = 0
        for u in users:
            uid = u.get("user_id")
            if not uid:
                continue
            row = await s.get(UserRow, uid)
            if row:
                row.google_sub = u.get("google_sub")
                row.data = u
            else:
                s.add(UserRow(user_id=uid, google_sub=u.get("google_sub"), data=u))
            n_u += 1

        # Notifications (insert if new)
        n_n = 0
        for n in notifications:
            nid = n.get("notification_id")
            if not nid:
                continue
            if await s.get(NotificationRow, nid):
                continue
            s.add(NotificationRow(
                notification_id=nid,
                user_id=n.get("user_id"),
                activity_id=n.get("activity_id"),
                title=n.get("title"),
                read=bool(n.get("read", False)),
                created_at=n.get("created_at", ""),
                data=n,
            ))
            n_n += 1

        await s.commit()

    print(f"Migrated: {n_it} itineraries, {n_u} users, {n_n} new notifications → {get_settings().database_url}")


if __name__ == "__main__":
    asyncio.run(main())
