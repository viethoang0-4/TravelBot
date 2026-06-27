"""Gmail SMTP email service using aiosmtplib."""
import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from ..config import get_settings

_WEBFLOW_BLUE = "#146ef5"


def _build_html(itinerary_title: str, alerts: list[dict]) -> str:
    fe_url = get_settings().frontend_url.rstrip("/")
    rows = ""
    for a in alerts:
        icon = "⚠️" if a["severity"] == "warning" else "🚨"
        rows += f"""
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;">
            <strong>{icon} {a['title']}</strong><br>
            <span style="color:#555;font-size:14px;">{a['body']}</span>
          </td>
        </tr>"""

    return f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Inter,Arial,sans-serif;background:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="560" cellpadding="0" cellspacing="0"
               style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
          <!-- Header -->
          <tr>
            <td style="background:{_WEBFLOW_BLUE};padding:20px 24px;">
              <span style="color:#fff;font-size:20px;font-weight:700;">🧭 Compasso</span>
              <p style="color:rgba(255,255,255,.85);margin:4px 0 0;font-size:13px;">
                Cảnh báo thời tiết cho lịch trình của bạn
              </p>
            </td>
          </tr>
          <!-- Title -->
          <tr>
            <td style="padding:20px 24px 8px;">
              <h2 style="margin:0;font-size:16px;color:#080808;">
                Lịch trình: {itinerary_title}
              </h2>
              <p style="margin:6px 0 0;font-size:13px;color:#555;">
                Phát hiện thay đổi thời tiết đáng chú ý. Vui lòng kiểm tra và điều chỉnh kế hoạch nếu cần.
              </p>
            </td>
          </tr>
          <!-- Alert rows -->
          <tr>
            <td style="padding:8px 24px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="border:1px solid #f0f0f0;border-radius:6px;overflow:hidden;">
                {rows}
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9f9f9;padding:14px 24px;text-align:center;">
              <span style="font-size:12px;color:#999;">
                Mở <a href="{fe_url}/chat" style="color:{_WEBFLOW_BLUE};">Compasso</a>
                để xem chi tiết và cập nhật lịch trình.
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


async def send_weather_alert(user: dict, itinerary: dict, alerts: list[dict]) -> bool:
    """Send HTML weather alert email. Returns True on success."""
    settings = get_settings()
    if not settings.gmail_user or not settings.gmail_app_password:
        print("[EMAIL] Gmail credentials not set — skipping email send")
        return False

    to_email = user.get("email", "")
    if not to_email:
        return False

    itinerary_title = itinerary.get("title", "Lịch trình")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"[Compasso] Cảnh báo thời tiết: {itinerary_title}"
    msg["From"] = f"{settings.email_from_name} <{settings.gmail_user}>"
    msg["To"] = to_email

    html_body = _build_html(itinerary_title, alerts)
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        await aiosmtplib.send(
            msg,
            hostname="smtp.gmail.com",
            port=587,
            start_tls=True,
            username=settings.gmail_user,
            password=settings.gmail_app_password,
        )
        print(f"[EMAIL] Sent weather alert to {to_email} ({len(alerts)} alerts)")
        return True
    except Exception as exc:
        print(f"[EMAIL] Failed to send to {to_email}: {exc}")
        return False
