"""APScheduler job — checks weather every hour for upcoming itineraries."""
from datetime import datetime, timezone, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from ..config import get_settings
from ..db.dependencies import get_itinerary_repo, get_user_repo
from . import alerts as alert_svc

scheduler = AsyncIOScheduler()


async def weather_check_job() -> dict:
    """Run weather checks for all upcoming itineraries of all users.

    Trả về tổng số cảnh báo mới + danh sách email chờ gửi (khi EMAIL_DIRECT_SEND=false,
    cron GitHub Actions sẽ gửi hộ vì HF Spaces chặn SMTP outbound).
    """
    print(f"\n[SCHEDULER] Weather check started at {datetime.now(timezone.utc).strftime('%H:%M UTC')}")

    user_repo = get_user_repo()
    itinerary_repo = get_itinerary_repo()

    users = await user_repo.list_all()
    today = datetime.now(timezone.utc).date()
    window_end = today + timedelta(days=7)

    total_alerts = 0
    for user in users:
        itineraries = await itinerary_repo.find_by_user(user["user_id"])
        for itin in itineraries:
            # Skip past itineraries
            try:
                end_date = datetime.strptime(itin.get("end_date", ""), "%Y-%m-%d").date()
                start_date = datetime.strptime(itin.get("start_date", ""), "%Y-%m-%d").date()
            except ValueError:
                continue
            if end_date < today or start_date > window_end:
                continue

            new_alerts = await alert_svc.check_itinerary(user, itin)
            if new_alerts:
                total_alerts += len(new_alerts)
                print(f"  → {len(new_alerts)} alert(s) for user={user.get('email', user['user_id'])} itin={itin.get('title', '')}")

    # Giao email cảnh báo. Nguồn là thông báo chưa gửi (email_sent=False) nên gồm cả phần
    # còn tồn từ các lượt trước chưa giao được -> retry tự nhiên, không mất email.
    pending_emails = await alert_svc.flush_pending_emails(get_settings().email_direct_send)

    print(f"[SCHEDULER] Done. Total new alerts: {total_alerts}, pending emails: {len(pending_emails)}\n")
    return {"total_alerts": total_alerts, "pending_emails": pending_emails}


def start_scheduler() -> None:
    scheduler.add_job(
        weather_check_job,
        trigger="interval",
        hours=1,
        id="weather_check",
        replace_existing=True,
        next_run_time=datetime.now(timezone.utc) + timedelta(seconds=60),  # first run after 60s
    )
    scheduler.start()
    print("[SCHEDULER] APScheduler started — weather check every 1h (first run in 60s)")


def stop_scheduler() -> None:
    scheduler.shutdown(wait=False)
    print("[SCHEDULER] APScheduler stopped")
