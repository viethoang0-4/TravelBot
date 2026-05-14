"""
Authentication endpoints.

POST /api/v1/auth/google  — verify Google ID token → return backend JWT + user
GET  /api/v1/auth/me      — return current user info
"""
from fastapi import APIRouter, Depends, HTTPException

from ..auth.google import verify_google_id_token
from ..auth.jwt_utils import create_access_token
from ..auth.dependencies import get_current_user
from ..db.base import UserRepository
from ..db.dependencies import get_user_repo
from pydantic import BaseModel

router = APIRouter()


class GoogleTokenRequest(BaseModel):
    id_token: str


@router.post("/auth/google")
async def login_with_google(
    body: GoogleTokenRequest,
    user_repo: UserRepository = Depends(get_user_repo),
):
    payload = await verify_google_id_token(body.id_token)

    google_data = {
        "sub": payload["sub"],
        "email": payload.get("email", ""),
        "name": payload.get("name", ""),
        "picture": payload.get("picture"),
    }

    user = await user_repo.find_or_create_by_google(google_data)
    access_token = create_access_token(sub=user["user_id"])

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "user_id": user["user_id"],
            "email": user["email"],
            "name": user["name"],
            "avatar_url": user.get("avatar_url"),
        },
    }


@router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "user_id": current_user["user_id"],
        "email": current_user["email"],
        "name": current_user["name"],
        "avatar_url": current_user.get("avatar_url"),
        "preferences": current_user.get("preferences", {}),
    }
