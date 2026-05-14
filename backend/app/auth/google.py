import asyncio
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from fastapi import HTTPException, status

from ..config import get_settings

# Reusable transport object (caches Google public keys internally)
_transport = google_requests.Request()


def _verify_sync(token_str: str, client_id: str) -> dict:
    return id_token.verify_oauth2_token(token_str, _transport, client_id)


async def verify_google_id_token(token_str: str) -> dict:
    settings = get_settings()
    if not settings.google_client_id:
        raise HTTPException(status_code=500, detail="Google OAuth not configured (GOOGLE_CLIENT_ID missing)")
    try:
        loop = asyncio.get_event_loop()
        payload = await loop.run_in_executor(
            None, _verify_sync, token_str, settings.google_client_id
        )
        return payload
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Google token verification failed: {exc}",
        )
