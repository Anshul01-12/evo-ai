import json

import redis.asyncio as aioredis

from app.core.config import get_settings

settings = get_settings()


class ConversationMemory:
    """Redis-backed short-term conversation memory."""

    def __init__(self):
        self.redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        self.ttl = 3600  # 1 hour

    def _key(self, conversation_id: str) -> str:
        return f"evo:memory:{conversation_id}"

    async def add(self, conversation_id: str, role: str, content: str) -> None:
        key = self._key(conversation_id)
        await self.redis.rpush(key, json.dumps({"role": role, "content": content}))
        await self.redis.expire(key, self.ttl)

    async def get_history(self, conversation_id: str, last_n: int = 20) -> list[dict]:
        key = self._key(conversation_id)
        raw = await self.redis.lrange(key, -last_n, -1)
        return [json.loads(m) for m in raw]

    async def clear(self, conversation_id: str) -> None:
        await self.redis.delete(self._key(conversation_id))

    async def set_summary(self, conversation_id: str, summary: str) -> None:
        await self.redis.set(f"evo:summary:{conversation_id}", summary, ex=self.ttl * 4)

    async def get_summary(self, conversation_id: str) -> str | None:
        return await self.redis.get(f"evo:summary:{conversation_id}")
