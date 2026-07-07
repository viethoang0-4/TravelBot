"""Rate limiter dùng chung (slowapi) — chống gọi API quá nhiều / lạm dụng.

Key theo IP: HF Spaces đứng SAU proxy nên IP thật nằm ở header X-Forwarded-For
(phần tử đầu tiên), không phải request.client.host. Lưu trạng thái in-memory
(đủ cho 1 process free-tier; restart là reset).
"""
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return get_remote_address(request)


# default_limits áp cho MỌI route (mạng an toàn). Endpoint nặng (LLM) siết chặt thêm
# bằng decorator @limiter.limit(...) tại chỗ.
limiter = Limiter(key_func=_client_ip, default_limits=["300/minute"])
