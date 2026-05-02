from __future__ import annotations

import sqlite3
from typing import Iterable


def _table_exists(conn: sqlite3.Connection, table: str) -> bool:
    return bool(conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=? LIMIT 1", (table,)).fetchone())


def _columns(conn: sqlite3.Connection, table: str) -> set[str]:
    if not _table_exists(conn, table):
        return set()
    return {str(row[1]) for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}


def _index(conn: sqlite3.Connection, table: str, name: str, columns: Iterable[str]) -> None:
    cols = tuple(columns)
    if not _table_exists(conn, table):
        return
    available = _columns(conn, table)
    if all(col in available for col in cols):
        conn.execute(f"CREATE INDEX IF NOT EXISTS {name} ON {table} ({', '.join(cols)})")


def apply_final_stack_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS platform_linked_accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          provider TEXT NOT NULL,
          provider_account_id TEXT NOT NULL,
          display_name TEXT,
          email TEXT,
          linked_at TEXT NOT NULL,
          last_seen_at TEXT,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          UNIQUE(provider, provider_account_id)
        );

        CREATE TABLE IF NOT EXISTS subscription_entitlements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
          platform TEXT NOT NULL DEFAULT 'manual',
          external_subscription_id TEXT,
          tier TEXT NOT NULL DEFAULT 'free',
          status TEXT NOT NULL DEFAULT 'inactive',
          starts_at TEXT,
          expires_at TEXT,
          benefits_json TEXT NOT NULL DEFAULT '{}',
          validation_record_id INTEGER,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS payment_validation_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
          platform TEXT NOT NULL,
          external_receipt_id TEXT,
          external_transaction_id TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          request_hash TEXT,
          response_json TEXT NOT NULL DEFAULT '{}',
          validated_at TEXT,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS subscription_audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
          platform TEXT NOT NULL DEFAULT 'system',
          action TEXT NOT NULL,
          old_status TEXT,
          new_status TEXT,
          reason TEXT NOT NULL DEFAULT '',
          metadata_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS worker_job_runs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          job_key TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'started',
          locked_by TEXT,
          started_at TEXT NOT NULL,
          finished_at TEXT,
          duration_ms INTEGER,
          error_message TEXT,
          metadata_json TEXT NOT NULL DEFAULT '{}'
        );
        """
    )

    indexes = [
        ("players", "idx_final_players_user", ("user_id",)),
        ("players", "idx_final_players_callsign", ("callsign",)),
        ("players", "idx_final_players_location", ("location_planet_id",)),
        ("sessions", "idx_final_sessions_user_last_seen", ("user_id", "last_seen_at")),
        ("sessions", "idx_final_sessions_expires", ("expires_at",)),
        ("planets", "idx_final_planets_galaxy_location", ("galaxy_id", "x", "y")),
        ("combat_battles", "idx_final_combat_player_status", ("player_id", "status")),
        ("combat_battles", "idx_final_combat_status_updated", ("status", "updated_at")),
        ("combat_battles", "idx_final_combat_planet_status", ("planet_id", "status")),
        ("inventory", "idx_final_inventory_player_item", ("player_id", "item_code")),
        ("inventory", "idx_final_inventory_player_category", ("player_id", "category")),
        ("cargo_hold", "idx_final_cargo_player_commodity", ("player_id", "commodity_id")),
        ("market_prices", "idx_final_market_planet_prices", ("planet_id", "commodity_id", "updated_at")),
        ("player_market_listings", "idx_final_listings_planet_status", ("planet_id", "status", "expires_at")),
        ("player_market_listings", "idx_final_listings_item_status", ("item_code", "status")),
        ("events", "idx_final_events_player_created", ("player_id", "created_at")),
        ("events", "idx_final_events_category_created", ("category", "created_at")),
        ("server_events", "idx_final_server_events_status_time", ("status", "starts_at", "ends_at")),
        ("leaderboard_snapshot_rows", "idx_final_leaderboard_rows_player_rank", ("player_id", "rank")),
        ("leaderboard_snapshots", "idx_final_leaderboard_current_period", ("is_current", "period", "metric_key")),
        ("platform_linked_accounts", "idx_final_platform_accounts_user", ("user_id", "provider")),
        ("subscription_entitlements", "idx_final_entitlements_player_status", ("player_id", "status", "expires_at")),
        ("subscription_entitlements", "idx_final_entitlements_user_status", ("user_id", "status", "expires_at")),
        ("payment_validation_records", "idx_final_payment_records_player", ("player_id", "platform", "created_at")),
        ("subscription_audit_logs", "idx_final_subscription_audit_player", ("player_id", "created_at")),
        ("worker_job_runs", "idx_final_worker_job_runs", ("job_key", "status", "started_at")),
    ]
    for table, name, cols in indexes:
        _index(conn, table, name, cols)
