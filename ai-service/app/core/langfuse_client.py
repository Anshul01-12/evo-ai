from __future__ import annotations

import time
from contextlib import contextmanager
from functools import lru_cache
from typing import Any

from app.core.config import get_settings

settings = get_settings()

try:
    from langfuse import Langfuse
    from langfuse.callback import CallbackHandler as LangfuseCallbackHandler

    LANGFUSE_AVAILABLE = True
except ImportError:  # pragma: no cover
    LANGFUSE_AVAILABLE = False
    Langfuse = None  # type: ignore[assignment]
    LangfuseCallbackHandler = None  # type: ignore[assignment]


@lru_cache
def get_langfuse() -> "Langfuse | None":
    if not LANGFUSE_AVAILABLE:
      return None

    if not settings.LANGFUSE_PUBLIC_KEY or not settings.LANGFUSE_SECRET_KEY:
        return None

    return Langfuse(
        public_key=settings.LANGFUSE_PUBLIC_KEY,
        secret_key=settings.LANGFUSE_SECRET_KEY,
        host=settings.LANGFUSE_HOST,
    )


def get_langfuse_callback(
    *,
    name: str,
    user_id: str | None = None,
    session_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> "LangfuseCallbackHandler | None":
    client = get_langfuse()
    if not client or not LangfuseCallbackHandler:
        return None

    trace = client.trace(
        name=name,
        user_id=user_id,
        session_id=session_id,
        metadata=metadata or {},
    )
    return LangfuseCallbackHandler(trace=trace, update_parent=True)


@contextmanager
def observe_operation(
    *,
    name: str,
    user_id: str | None = None,
    session_id: str | None = None,
    input_payload: Any = None,
    metadata: dict[str, Any] | None = None,
):
    client = get_langfuse()
    if not client:
        yield None
        return

    trace = client.trace(
        name=name,
        user_id=user_id,
        session_id=session_id,
        input=input_payload,
        metadata=metadata or {},
    )
    start_time = time.perf_counter()

    try:
        yield trace
    except Exception as exc:
        trace.update(
            output={"error": str(exc)},
            metadata={
                **(metadata or {}),
                "latency_ms": round((time.perf_counter() - start_time) * 1000, 2),
                "status": "error",
            },
        )
        raise
    else:
        trace.update(
            metadata={
                **(metadata or {}),
                "latency_ms": round((time.perf_counter() - start_time) * 1000, 2),
                "status": "success",
            }
        )
