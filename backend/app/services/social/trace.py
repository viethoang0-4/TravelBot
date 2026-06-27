"""
Trace/log toàn bộ luồng social pipeline ra terminal để dễ kiểm soát.

In an toàn với mọi encoding console (Windows cp1252 không vỡ): nếu ký tự không
mã hoá được thì thay thế, KHÔNG ném UnicodeEncodeError làm hỏng request.
"""
import sys


def log(msg: str = "") -> None:
    try:
        print(msg, flush=True)
    except UnicodeEncodeError:
        enc = getattr(sys.stdout, "encoding", None) or "utf-8"
        print(msg.encode(enc, errors="replace").decode(enc), flush=True)


def section(title: str) -> None:
    log("")
    log("=" * 16 + f"  {title}  " + "=" * 16)


def trunc(text: str, n: int = 180) -> str:
    """Gộp khoảng trắng + cắt ngắn cho dễ đọc trên một dòng."""
    text = " ".join((text or "").split())
    return text if len(text) <= n else text[:n] + "…"
