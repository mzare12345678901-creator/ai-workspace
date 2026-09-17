import httpx
from typing import List, Dict
from app.config import settings

SYSTEM_PROMPT = """تو یک دستیار هوشمند، دقیق و مفید هستی.
پاسخ‌ها را به زبان کاربر بده. اگر کاربر فارسی نوشت، فارسی پاسخ بده.
برای کد از بلوک‌های مارک‌داون استفاده کن."""


class AIGateway:
    def __init__(self, api_key: str = None, base_url: str = None, model: str = None):
        self.api_key = api_key or settings.OPENAI_API_KEY
        self.base_url = (base_url or settings.OPENAI_BASE_URL).rstrip("/")
        self.model = model or settings.OPENAI_MODEL

    async def chat(self, messages: List[Dict[str, str]]) -> str:
        if not self.api_key:
            return "⚠️ کلید API تنظیم نشده. از بخش تنظیمات یا فایل .env مقداردهی کن."
        payload = {
            "model": self.model,
            "messages": [{"role": "system", "content": SYSTEM_PROMPT}] + messages,
            "temperature": 0.7,
        }
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=90) as client:
            try:
                r = await client.post(f"{self.base_url}/chat/completions", json=payload, headers=headers)
                r.raise_for_status()
                return r.json()["choices"][0]["message"]["content"]
            except httpx.HTTPStatusError as e:
                return f"❌ خطای API ({e.response.status_code}): {e.response.text[:300]}"
            except Exception as e:
                return f"❌ خطا در ارتباط با AI: {e}"


ai_gateway = AIGateway()