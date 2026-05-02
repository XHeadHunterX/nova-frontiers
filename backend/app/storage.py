from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

from .config import get_config

LOGGER = logging.getLogger("nova.storage")


class StorageAdapter:
    mode = "local"

    def save_bytes(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        raise NotImplementedError

    def open_bytes(self, key: str) -> bytes:
        raise NotImplementedError

    def public_url(self, key: str) -> str:
        raise NotImplementedError

    def signed_url(self, key: str, expires_seconds: int = 900) -> str:
        return self.public_url(key)


class LocalStorageAdapter(StorageAdapter):
    mode = "local"

    def __init__(self, root: Path, public_prefix: str = "/storage") -> None:
        self.root = root
        self.public_prefix = public_prefix.rstrip("/")
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        clean = str(key).replace("\\", "/").lstrip("/")
        target = (self.root / clean).resolve()
        if not str(target).startswith(str(self.root.resolve())):
            raise ValueError("Invalid storage key")
        return target

    def save_bytes(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        target = self._path(key)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        return self.public_url(key)

    def open_bytes(self, key: str) -> bytes:
        return self._path(key).read_bytes()

    def public_url(self, key: str) -> str:
        clean = str(key).replace("\\", "/").lstrip("/")
        return f"{self.public_prefix}/{clean}"


class BotoObjectStorageAdapter(StorageAdapter):
    def __init__(self, provider: str, bucket: str, endpoint_url: Optional[str], region: Optional[str], access_key: str, secret_key: str) -> None:
        try:
            import boto3  # type: ignore
        except Exception as exc:
            raise RuntimeError("boto3 package is not installed") from exc
        self.mode = provider
        self.bucket = bucket
        self.client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            region_name=region,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
        )

    def save_bytes(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        self.client.put_object(Bucket=self.bucket, Key=key, Body=data, ContentType=content_type)
        return self.public_url(key)

    def open_bytes(self, key: str) -> bytes:
        return self.client.get_object(Bucket=self.bucket, Key=key)["Body"].read()

    def public_url(self, key: str) -> str:
        return f"/storage/{key.lstrip('/')}"

    def signed_url(self, key: str, expires_seconds: int = 900) -> str:
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=max(60, int(expires_seconds)),
        )


_adapter: Optional[StorageAdapter] = None


def get_storage_adapter(app_dir: Optional[Path] = None) -> StorageAdapter:
    global _adapter
    if _adapter is not None:
        return _adapter
    cfg = get_config()
    base = app_dir or Path(__file__).resolve().parent
    local_root = (base / cfg.local_storage_path).resolve() if not Path(cfg.local_storage_path).is_absolute() else Path(cfg.local_storage_path)
    provider = cfg.object_storage_provider.lower()
    if provider == "r2" and cfg.object_storage_configured:
        try:
            _adapter = BotoObjectStorageAdapter("r2", cfg.r2_bucket or "", cfg.r2_endpoint, None, cfg.r2_access_key_id or "", cfg.r2_secret_access_key or "")
            LOGGER.info("Object storage adapter enabled: r2")
            return _adapter
        except Exception as exc:
            LOGGER.warning("R2 object storage is configured but unavailable; using local storage fallback. error=%r", exc)
    elif provider == "s3" and cfg.object_storage_configured:
        try:
            _adapter = BotoObjectStorageAdapter("s3", cfg.s3_bucket or "", None, cfg.s3_region, cfg.s3_access_key_id or "", cfg.s3_secret_access_key or "")
            LOGGER.info("Object storage adapter enabled: s3")
            return _adapter
        except Exception as exc:
            LOGGER.warning("S3 object storage is configured but unavailable; using local storage fallback. error=%r", exc)
    else:
        LOGGER.warning("Object storage variables are missing or provider is local; using local storage at %s.", local_root)
    _adapter = LocalStorageAdapter(local_root)
    return _adapter
