from __future__ import annotations

import json
import logging
from typing import Any, Set

from fastapi import WebSocket

from .redis_adapter import get_runtime_adapter

LOGGER = logging.getLogger("nova.websocket")


class BroadcastManager:
    def __init__(self) -> None:
        self._connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.add(websocket)
        LOGGER.info("WebSocket connected; local_connections=%s", len(self._connections))

    def disconnect(self, websocket: WebSocket) -> None:
        self._connections.discard(websocket)
        LOGGER.info("WebSocket disconnected; local_connections=%s", len(self._connections))

    async def broadcast(self, event: str, payload: Any) -> None:
        message = json.dumps({"event": event, "payload": payload}, default=str)
        try:
            get_runtime_adapter().publish("nova:ws:broadcast", message)
        except Exception as exc:
            LOGGER.warning("Redis pub/sub publish failed; local WebSocket broadcast will continue. error=%r", exc)
        stale: list[WebSocket] = []
        for websocket in list(self._connections):
            try:
                await websocket.send_text(message)
            except Exception:
                stale.append(websocket)
        for websocket in stale:
            self.disconnect(websocket)


broadcast_manager = BroadcastManager()
