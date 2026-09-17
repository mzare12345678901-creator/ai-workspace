from fastapi import APIRouter
from app.schemas import SettingsIn
from app.ai_gateway import ai_gateway

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/")
def get_settings():
    key = ai_gateway.api_key or ""
    masked = key[:6] + "•" * 8 + key[-4:] if len(key) > 12 else ("تنظیم نشده" if not key else "•••")
    return {"api_key_masked": masked, "base_url": ai_gateway.base_url, "model": ai_gateway.model}


@router.post("/")
def update_settings(data: SettingsIn):
    if data.api_key is not None:
        ai_gateway.api_key = data.api_key
    if data.base_url is not None:
        ai_gateway.base_url = data.base_url.rstrip("/")
    if data.model is not None:
        ai_gateway.model = data.model
    return {"ok": True}