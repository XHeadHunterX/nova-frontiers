from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict


FREE_ENTITLEMENTS: Dict[str, Any] = {
    "tier": "free",
    "queue_limit_bonus": 0,
    "storage_bonus_pct": 0,
    "cargo_convenience_pct": 0,
    "cooldown_reduction_pct": 0,
    "market_convenience": False,
    "cosmetics": [],
}


def _parse_dt(raw: Any) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except Exception:
        return None


def _json(raw: Any, default: Any) -> Any:
    try:
        return json.loads(raw) if raw else default
    except Exception:
        return default


def player_entitlements(conn: sqlite3.Connection, player_id: int) -> Dict[str, Any]:
    row = conn.execute(
        """
        SELECT * FROM subscription_entitlements
        WHERE player_id=? AND status IN ('active','trialing','grace')
        ORDER BY updated_at DESC LIMIT 1
        """,
        (int(player_id),),
    ).fetchone()
    if not row:
        return dict(FREE_ENTITLEMENTS)
    rec = dict(row)
    expires_at = _parse_dt(rec.get("expires_at"))
    if expires_at and expires_at <= datetime.now(timezone.utc):
        return dict(FREE_ENTITLEMENTS)
    benefits = dict(FREE_ENTITLEMENTS)
    benefits.update(_json(rec.get("benefits_json"), {}) or {})
    benefits["tier"] = rec.get("tier") or "subscriber"
    benefits["subscription_status"] = rec.get("status") or "active"
    benefits["expires_at"] = rec.get("expires_at")
    benefits["combat_power_granted"] = False
    return benefits


def convenience_cooldown_multiplier(entitlements: Dict[str, Any]) -> float:
    pct = max(0, min(25, int(entitlements.get("cooldown_reduction_pct") or 0)))
    return round(1.0 - pct / 100.0, 4)
