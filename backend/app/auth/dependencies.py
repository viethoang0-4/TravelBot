from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from ..db.base import UserRepository
from ..db.dependencies import get_user_repo
from .jwt_utils import decode_token

_security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_security),
    user_repo: UserRepository = Depends(get_user_repo),
) -> dict:
    token = credentials.credentials
    google_sub = decode_token(token)
    user = await user_repo.find_by_google_sub(google_sub)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
