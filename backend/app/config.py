from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from typing import List, Optional


def _csv_env(*names: str, default: str = "") -> List[str]:
    raw = ""
    for name in names:
        raw = os.getenv(name, "").strip()
        if raw:
            break
    if not raw:
        raw = default
    return [item.strip().rstrip("/") for item in raw.split(",") if item.strip()]


def _bool_env(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "y", "on"}


@dataclass(frozen=True)
class AppConfig:
    platform_mode: str
    public_game_url: Optional[str]
    api_base_url: Optional[str]
    ws_base_url: Optional[str]
    cors_allowed_origins: List[str]
    redis_url: Optional[str]
    worker_enabled: bool
    object_storage_provider: str
    r2_bucket: Optional[str]
    r2_endpoint: Optional[str]
    r2_access_key_id: Optional[str]
    r2_secret_access_key: Optional[str]
    s3_bucket: Optional[str]
    s3_region: Optional[str]
    s3_access_key_id: Optional[str]
    s3_secret_access_key: Optional[str]
    local_storage_path: str
    slow_request_ms: int

    @property
    def object_storage_configured(self) -> bool:
        provider = self.object_storage_provider.lower()
        if provider == "r2":
            return bool(self.r2_bucket and self.r2_endpoint and self.r2_access_key_id and self.r2_secret_access_key)
        if provider == "s3":
            return bool(self.s3_bucket and self.s3_region and self.s3_access_key_id and self.s3_secret_access_key)
        return False


@lru_cache(maxsize=1)
def get_config() -> AppConfig:
    default_origins = ",".join(
        [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "https://novafrontiersgame.com",
            "https://www.novafrontiersgame.com",
            "https://nova-frontiers.pages.dev",
            "https://nova-frontiers-site.pages.dev",
        ]
    )
    provider = os.getenv("OBJECT_STORAGE_PROVIDER", "local").strip().lower() or "local"
    return AppConfig(
        platform_mode=os.getenv("PLATFORM_MODE", "render").strip().lower() or "render",
        public_game_url=os.getenv("PUBLIC_GAME_URL") or None,
        api_base_url=os.getenv("API_BASE_URL") or None,
        ws_base_url=os.getenv("WS_BASE_URL") or None,
        cors_allowed_origins=_csv_env("CORS_ALLOWED_ORIGINS", "NOVA_CORS_ORIGINS", default=default_origins),
        redis_url=os.getenv("REDIS_URL") or None,
        worker_enabled=_bool_env("WORKER_ENABLED", False),
        object_storage_provider=provider,
        r2_bucket=os.getenv("R2_BUCKET") or None,
        r2_endpoint=os.getenv("R2_ENDPOINT") or None,
        r2_access_key_id=os.getenv("R2_ACCESS_KEY_ID") or None,
        r2_secret_access_key=os.getenv("R2_SECRET_ACCESS_KEY") or None,
        s3_bucket=os.getenv("S3_BUCKET") or None,
        s3_region=os.getenv("S3_REGION") or None,
        s3_access_key_id=os.getenv("S3_ACCESS_KEY_ID") or None,
        s3_secret_access_key=os.getenv("S3_SECRET_ACCESS_KEY") or None,
        local_storage_path=os.getenv("LOCAL_STORAGE_PATH", "data/storage"),
        slow_request_ms=int(os.getenv("SLOW_REQUEST_LOG_MS", "750")),
    )


def describe_runtime_modes() -> dict:
    cfg = get_config()
    return {
        "platform_mode": cfg.platform_mode,
        "redis": "redis" if cfg.redis_url else "memory",
        "storage": cfg.object_storage_provider if cfg.object_storage_configured else "local",
        "worker_enabled": cfg.worker_enabled,
        "public_game_url": cfg.public_game_url,
        "api_base_url": cfg.api_base_url,
        "ws_base_url": cfg.ws_base_url,
    }
