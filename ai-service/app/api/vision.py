# Vision endpoints are served via /image/* (see app/api/image.py)
# This file kept to avoid import errors from main.py if re-added.

from fastapi import APIRouter

router = APIRouter(prefix="/vision", tags=["vision"])
