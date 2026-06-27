"""
SQLAlchemy (async) implementations of the repository interfaces — PostgreSQL.

Design: each document (itinerary / user / notification) is stored as-is in a
JSONB `data` column, with a few flat columns mirrored out for indexing/queries.
This keeps the dict-based contract identical to the JSON mock (drop-in swap) while
giving real ACID storage. Switch on by setting DATABASE_URL in .env, e.g.
    DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/travelbot

Tables are created automatically on startup (see main.py -> init_db()).
"""
from typing import Any, Optional

from sqlalchemy import Boolean, String, select, delete, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine, AsyncEngine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.types import JSON

from ..config import get_settings
from .base import ItineraryRepository, UserRepository, NotificationRepository

# JSONB on Postgres, plain JSON elsewhere (keeps this usable on sqlite too).
_JSONDoc = JSON().with_variant(JSONB, "postgresql")


class Base(DeclarativeBase):
    pass


class ItineraryRow(Base):
    __tablename__ = "itineraries"
    itinerary_id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)
    data: Mapped[dict] = mapped_column(_JSONDoc, nullable=False)


class UserRow(Base):
    __tablename__ = "users"
    user_id: Mapped[str] = mapped_column(String, primary_key=True)
    google_sub: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)
    data: Mapped[dict] = mapped_column(_JSONDoc, nullable=False)


class NotificationRow(Base):
    __tablename__ = "notifications"
    notification_id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)
    activity_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    title: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    data: Mapped[dict] = mapped_column(_JSONDoc, nullable=False)


# ── Engine / session (lazy singleton) ───────────────────────────────────────

_engine: Optional[AsyncEngine] = None
_SessionLocal: Optional[async_sessionmaker] = None


def _normalize_url(url: str) -> tuple[str, dict]:
    """
    Normalize the DB URL for asyncpg and extract connect_args.

    asyncpg does NOT accept `sslmode` in the query string — it uses `ssl`.
    Supabase (and most cloud Postgres providers) require SSL, so we:
      1. Upgrade scheme to postgresql+asyncpg://
      2. Replace ?sslmode=require → ?ssl=require  (asyncpg param)
      3. If neither ssl nor sslmode is in the URL but the host looks like a
         cloud provider (supabase, neon, render, railway, …) → add ssl=require
         automatically so users can paste the URL verbatim.
    Returns (normalized_url, connect_args_for_engine).
    """
    # Fix scheme
    for prefix, replacement in [
        ("postgresql://", "postgresql+asyncpg://"),
        ("postgres://", "postgresql+asyncpg://"),
    ]:
        if url.startswith(prefix):
            url = replacement + url[len(prefix):]
            break

    # sslmode → ssl (asyncpg naming)
    url = url.replace("sslmode=require", "ssl=require")
    url = url.replace("sslmode=prefer", "ssl=prefer")

    # Auto-detect cloud hosts that always need SSL
    _CLOUD_HOSTS = (
        "supabase.com", "supabase.co", "neon.tech",
        "render.com", "railway.app", "cockroachlabs.cloud",
    )
    needs_ssl = any(h in url for h in _CLOUD_HOSTS)
    has_ssl_param = "ssl=" in url
    if needs_ssl and not has_ssl_param:
        sep = "&" if "?" in url else "?"
        url = url + sep + "ssl=require"

    connect_args: dict = {}
    # Supabase pooler (PgBouncer / Supavisor) không hỗ trợ prepared statement của
    # asyncpg → tắt cache để tránh lỗi "prepared statement does not exist".
    if "pooler.supabase.com" in url or ":6543" in url:
        connect_args["statement_cache_size"] = 0

    return url, connect_args


def get_session_factory() -> async_sessionmaker:
    global _engine, _SessionLocal
    if _SessionLocal is None:
        url, connect_args = _normalize_url(get_settings().database_url)
        _engine = create_async_engine(
            url,
            pool_pre_ping=True,
            future=True,
            connect_args=connect_args,
        )
        _SessionLocal = async_sessionmaker(_engine, expire_on_commit=False)
    return _SessionLocal


async def init_db() -> None:
    """Create tables if they don't exist (called once on startup)."""
    get_session_factory()  # build the engine
    assert _engine is not None

    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


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


# ── Itinerary ────────────────────────────────────────────────────────────────

class SqlItineraryRepository(ItineraryRepository):
    async def save(self, itinerary: dict) -> dict:
        Session = get_session_factory()
        async with Session() as s:
            row = await s.get(ItineraryRow, itinerary.get("itinerary_id"))
            if row is None:
                s.add(ItineraryRow(
                    itinerary_id=itinerary["itinerary_id"],
                    user_id=itinerary.get("user_id"),
                    data=itinerary,
                ))
            else:
                row.user_id = itinerary.get("user_id")
                row.data = itinerary  # reassign so JSON change is detected
            await s.commit()
        return itinerary

    async def find_all(self) -> list[dict]:
        Session = get_session_factory()
        async with Session() as s:
            rows = (await s.execute(select(ItineraryRow.data))).scalars().all()
        return [_summary(r) for r in rows]

    async def find_by_id(self, itinerary_id: str) -> Optional[dict]:
        Session = get_session_factory()
        async with Session() as s:
            row = await s.get(ItineraryRow, itinerary_id)
        return row.data if row else None

    async def find_by_user(self, user_id: str) -> list[dict]:
        Session = get_session_factory()
        async with Session() as s:
            rows = (await s.execute(
                select(ItineraryRow.data).where(ItineraryRow.user_id == user_id)
            )).scalars().all()
        return list(rows)

    async def delete(self, itinerary_id: str) -> bool:
        Session = get_session_factory()
        async with Session() as s:
            res = await s.execute(
                delete(ItineraryRow).where(ItineraryRow.itinerary_id == itinerary_id)
            )
            await s.commit()
        return res.rowcount > 0


# ── User ─────────────────────────────────────────────────────────────────────

class SqlUserRepository(UserRepository):
    async def find_or_create(self, user_id: str) -> dict:
        Session = get_session_factory()
        async with Session() as s:
            row = await s.get(UserRow, user_id)
            if row:
                return row.data
            data = {"user_id": user_id, "preferences": {}, "itinerary_ids": []}
            s.add(UserRow(user_id=user_id, google_sub=None, data=data))
            await s.commit()
        return data

    async def find_by_google_sub(self, google_sub: str) -> Optional[dict]:
        Session = get_session_factory()
        async with Session() as s:
            row = (await s.execute(
                select(UserRow).where(
                    (UserRow.google_sub == google_sub) | (UserRow.user_id == google_sub)
                )
            )).scalars().first()
        return row.data if row else None

    async def find_or_create_by_google(self, google_data: dict) -> dict:
        sub = google_data["sub"]
        Session = get_session_factory()
        async with Session() as s:
            row = (await s.execute(
                select(UserRow).where(
                    (UserRow.google_sub == sub) | (UserRow.user_id == sub)
                )
            )).scalars().first()
            if row:
                data = dict(row.data)
                data["name"] = google_data.get("name", data.get("name", ""))
                data["avatar_url"] = google_data.get("picture", data.get("avatar_url"))
                data["email"] = google_data.get("email", data.get("email", ""))
                row.google_sub = sub
                row.data = data
                await s.commit()
                return data
            from datetime import datetime, timezone
            data = {
                "user_id": sub,
                "google_sub": sub,
                "email": google_data.get("email", ""),
                "name": google_data.get("name", ""),
                "avatar_url": google_data.get("picture"),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "preferences": {},
                "itinerary_ids": [],
            }
            s.add(UserRow(user_id=sub, google_sub=sub, data=data))
            await s.commit()
        return data

    async def list_all(self) -> list[dict]:
        Session = get_session_factory()
        async with Session() as s:
            rows = (await s.execute(select(UserRow.data))).scalars().all()
        return list(rows)

    async def update_preferences(self, user_id: str, preferences: dict) -> dict:
        Session = get_session_factory()
        async with Session() as s:
            row = await s.get(UserRow, user_id)
            if row:
                data = dict(row.data)
                prefs = dict(data.get("preferences", {}))
                prefs.update(preferences)
                data["preferences"] = prefs
                row.data = data
                await s.commit()
                return data
            data = {"user_id": user_id, "preferences": preferences, "itinerary_ids": []}
            s.add(UserRow(user_id=user_id, google_sub=None, data=data))
            await s.commit()
        return data


# ── Notification ─────────────────────────────────────────────────────────────

class SqlNotificationRepository(NotificationRepository):
    async def save(self, notification: dict) -> dict:
        Session = get_session_factory()
        async with Session() as s:
            s.add(NotificationRow(
                notification_id=notification["notification_id"],
                user_id=notification.get("user_id"),
                activity_id=notification.get("activity_id"),
                title=notification.get("title"),
                read=bool(notification.get("read", False)),
                created_at=notification.get("created_at", ""),
                data=notification,
            ))
            await s.commit()
        return notification

    async def find_by_user(self, user_id: str, unread_only: bool = False) -> list[dict]:
        Session = get_session_factory()
        async with Session() as s:
            stmt = select(NotificationRow.data).where(NotificationRow.user_id == user_id)
            if unread_only:
                stmt = stmt.where(NotificationRow.read.is_(False))
            stmt = stmt.order_by(NotificationRow.created_at.desc()).limit(50)
            rows = (await s.execute(stmt)).scalars().all()
        return list(rows)

    async def mark_read(self, notification_id: str) -> Optional[dict]:
        Session = get_session_factory()
        async with Session() as s:
            row = await s.get(NotificationRow, notification_id)
            if not row:
                return None
            data = dict(row.data)
            data["read"] = True
            row.read = True
            row.data = data
            await s.commit()
            return data

    async def mark_all_read(self, user_id: str) -> int:
        Session = get_session_factory()
        async with Session() as s:
            rows = (await s.execute(
                select(NotificationRow).where(
                    (NotificationRow.user_id == user_id) & (NotificationRow.read.is_(False))
                )
            )).scalars().all()
            for row in rows:
                data = dict(row.data)
                data["read"] = True
                row.read = True
                row.data = data
            await s.commit()
        return len(rows)

    async def exists_for_activity(self, user_id: str, activity_id: str, title: str) -> bool:
        Session = get_session_factory()
        async with Session() as s:
            found = (await s.execute(
                select(func.count()).select_from(NotificationRow).where(
                    (NotificationRow.user_id == user_id)
                    & (NotificationRow.activity_id == activity_id)
                    & (NotificationRow.title == title)
                )
            )).scalar_one()
        return found > 0
