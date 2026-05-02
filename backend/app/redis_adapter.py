from __future__ import annotations

import logging
import secrets
import threading
import time
from typing import Dict, Optional, Tuple

from .config import get_config

LOGGER = logging.getLogger("nova.runtime")


class RuntimeAdapter:
    mode = "memory"

    def set(self, key: str, value: str, ttl_seconds: Optional[int] = None) -> bool:
        raise NotImplementedError

    def get(self, key: str) -> Optional[str]:
        raise NotImplementedError

    def delete(self, key: str) -> None:
        raise NotImplementedError

    def acquire_lock(self, key: str, ttl_seconds: int = 30) -> Optional[str]:
        token = secrets.token_hex(16)
        ok = self.set(f"lock:{key}", token, ttl_seconds=ttl_seconds, nx=True)  # type: ignore[arg-type]
        return token if ok else None

    def release_lock(self, key: str, token: str) -> None:
        lock_key = f"lock:{key}"
        if self.get(lock_key) == token:
            self.delete(lock_key)

    def rate_limit(self, key: str, limit: int, window_seconds: int) -> bool:
        raise NotImplementedError

    def publish(self, channel: str, payload: str) -> None:
        return None


class InMemoryRuntimeAdapter(RuntimeAdapter):
    mode = "memory"

    def __init__(self) -> None:
        self._values: Dict[str, Tuple[str, Optional[float]]] = {}
        self._hits: Dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def _prune(self, now: Optional[float] = None) -> None:
        now = time.time() if now is None else now
        expired = [key for key, (_, expires_at) in self._values.items() if expires_at and expires_at <= now]
        for key in expired[:1000]:
            self._values.pop(key, None)

    def set(self, key: str, value: str, ttl_seconds: Optional[int] = None, nx: bool = False) -> bool:
        now = time.time()
        expires_at = now + ttl_seconds if ttl_seconds else None
        with self._lock:
            self._prune(now)
            if nx and key in self._values:
                return False
            self._values[key] = (str(value), expires_at)
            return True

    def get(self, key: str) -> Optional[str]:
        now = time.time()
        with self._lock:
            self._prune(now)
            item = self._values.get(key)
            return item[0] if item else None

    def delete(self, key: str) -> None:
        with self._lock:
            self._values.pop(key, None)

    def rate_limit(self, key: str, limit: int, window_seconds: int) -> bool:
        now = time.time()
        with self._lock:
            hits = [ts for ts in self._hits.get(key, []) if now - ts < window_seconds]
            if len(hits) >= limit:
                self._hits[key] = hits
                return False
            hits.append(now)
            self._hits[key] = hits
            if len(self._hits) > 5000:
                for stale_key in list(self._hits.keys())[:1000]:
                    self._hits[stale_key] = [ts for ts in self._hits[stale_key] if now - ts < 3600]
                    if not self._hits[stale_key]:
                        self._hits.pop(stale_key, None)
            return True


class RedisRuntimeAdapter(RuntimeAdapter):
    mode = "redis"

    def __init__(self, url: str) -> None:
        try:
            import redis  # type: ignore
        except Exception as exc:
            raise RuntimeError("redis package is not installed") from exc
        self._redis = redis.Redis.from_url(url, decode_responses=True, socket_connect_timeout=2, socket_timeout=2)
        self._redis.ping()

    def set(self, key: str, value: str, ttl_seconds: Optional[int] = None, nx: bool = False) -> bool:
        return bool(self._redis.set(key, str(value), ex=ttl_seconds, nx=nx))

    def get(self, key: str) -> Optional[str]:
        value = self._redis.get(key)
        return str(value) if value is not None else None

    def delete(self, key: str) -> None:
        self._redis.delete(key)

    def release_lock(self, key: str, token: str) -> None:
        lock_key = f"lock:{key}"
        script = """
        if redis.call('get', KEYS[1]) == ARGV[1] then
          return redis.call('del', KEYS[1])
        end
        return 0
        """
        self._redis.eval(script, 1, lock_key, token)

    def rate_limit(self, key: str, limit: int, window_seconds: int) -> bool:
        redis_key = f"rate:{key}"
        pipe = self._redis.pipeline()
        pipe.incr(redis_key)
        pipe.expire(redis_key, window_seconds, nx=True)
        count, _ = pipe.execute()
        return int(count or 0) <= limit

    def publish(self, channel: str, payload: str) -> None:
        self._redis.publish(channel, payload)


_adapter: Optional[RuntimeAdapter] = None


def get_runtime_adapter() -> RuntimeAdapter:
    global _adapter
    if _adapter is not None:
        return _adapter
    cfg = get_config()
    if not cfg.redis_url:
        LOGGER.warning("REDIS_URL is not set; using in-memory runtime locks, presence, rate limits, and local WebSocket broadcast.")
        _adapter = InMemoryRuntimeAdapter()
        return _adapter
    try:
        _adapter = RedisRuntimeAdapter(cfg.redis_url)
        LOGGER.info("Redis runtime adapter enabled for locks, presence, rate limits, and pub/sub preparation.")
        return _adapter
    except Exception as exc:
        LOGGER.warning("Redis connection failed; falling back to in-memory runtime adapter. Permanent player data remains in the database. error=%r", exc)
        _adapter = InMemoryRuntimeAdapter()
        return _adapter
