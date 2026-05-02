from __future__ import annotations

import logging
import os
import socket
import time
import traceback
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Callable, Iterator, Optional

from .redis_adapter import get_runtime_adapter

LOGGER = logging.getLogger("nova.worker")


def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def _job_lock(job_key: str, ttl_seconds: int = 300) -> Iterator[bool]:
    runtime = get_runtime_adapter()
    token = runtime.acquire_lock(f"worker:{job_key}", ttl_seconds=ttl_seconds)
    if not token:
        LOGGER.info("Worker job skipped because another process holds the lock: %s", job_key)
        yield False
        return
    try:
        yield True
    finally:
        runtime.release_lock(f"worker:{job_key}", token)


def _record_job(conn, job_key: str, status: str, started_at: str, error: Optional[str] = None, metadata: str = "{}") -> None:
    finished_at = _iso()
    started = datetime.fromisoformat(started_at)
    finished = datetime.fromisoformat(finished_at)
    duration_ms = int((finished - started).total_seconds() * 1000)
    conn.execute(
        """
        INSERT INTO worker_job_runs(job_key,status,locked_by,started_at,finished_at,duration_ms,error_message,metadata_json)
        VALUES (?,?,?,?,?,?,?,?)
        """,
        (job_key, status, socket.gethostname(), started_at, finished_at, duration_ms, error, metadata),
    )


def run_job(job_key: str, fn: Callable[[object], None], lock_ttl_seconds: int = 300) -> None:
    from . import main

    with _job_lock(job_key, ttl_seconds=lock_ttl_seconds) as locked:
        if not locked:
            return
        started_at = _iso()
        conn = main.connect()
        try:
            conn.execute("BEGIN IMMEDIATE")
            fn(conn)
            _record_job(conn, job_key, "finished", started_at)
            conn.commit()
            LOGGER.info("Worker job finished: %s", job_key)
        except Exception as exc:
            conn.rollback()
            try:
                conn.execute("BEGIN IMMEDIATE")
                _record_job(conn, job_key, "error", started_at, error=str(exc)[:1000])
                conn.commit()
            except Exception:
                conn.rollback()
            LOGGER.warning("Worker job failed: %s error=%r\n%s", job_key, exc, traceback.format_exc())
        finally:
            conn.close()


def npc_simulation_job(conn) -> None:
    from . import main

    main.run_background_world_tick(conn)


def server_events_job(conn) -> None:
    from . import main

    main.ensure_server_event_schedule(conn)
    main.process_server_events(conn)


def leaderboard_refresh_job(conn) -> None:
    from . import main

    if "nova_leaderboard_lightweight_maintenance_tick" in main.__dict__:
        main.nova_leaderboard_lightweight_maintenance_tick()
    elif "nova_generate_leaderboards" in main.__dict__:
        main.nova_generate_leaderboards(conn, generated_by="worker")


def cleanup_job(conn) -> None:
    from . import main

    main.prune_admin_action_logs(conn)
    conn.execute("DELETE FROM worker_job_runs WHERE started_at < datetime('now','-14 days')")
    conn.execute("DELETE FROM action_nonces WHERE created_at < ?", (main.iso(main.utcnow() - main.timedelta(hours=6)),))


def economy_maintenance_job(conn) -> None:
    from . import main

    main.resolve_market_restock(conn, force=False)


def run_once() -> None:
    from . import main

    main.migrate()
    jobs: list[tuple[str, Callable[[object], None], int]] = [
        ("npc_simulation", npc_simulation_job, 180),
        ("server_events", server_events_job, 300),
        ("leaderboard_refresh", leaderboard_refresh_job, 900),
        ("cleanup", cleanup_job, 300),
        ("economy_maintenance", economy_maintenance_job, 300),
    ]
    for job_key, fn, ttl in jobs:
        run_job(job_key, fn, lock_ttl_seconds=ttl)


def main() -> None:
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
    interval = int(os.getenv("WORKER_LOOP_SECONDS", "60"))
    once = os.getenv("WORKER_RUN_ONCE", "0").strip().lower() in {"1", "true", "yes", "y"}
    LOGGER.info("Nova worker starting; interval=%ss once=%s", interval, once)
    while True:
        run_once()
        if once:
            return
        time.sleep(max(5, interval))


if __name__ == "__main__":
    main()
