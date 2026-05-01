from pathlib import Path
import re
import shutil
import textwrap
from datetime import datetime

ROOT = Path.cwd()
BACKEND = ROOT / "backend" / "app" / "main.py"
FRONTEND = ROOT / "frontend" / "src" / "main.jsx"
CSS = ROOT / "frontend" / "src" / "styles.css"
NOTES = ROOT / "NOVA_LEADERBOARDS_STATE_SLIMMING_NOTES.md"
CHECKLIST = ROOT / "NOVA_LEADERBOARDS_STATE_SLIMMING_TEST_CHECKLIST.md"
CHANGELOG = ROOT / "CHANGELOG_LEADERBOARDS_STATE_SLIMMING_PATCH.txt"

BACKEND_MARKER = "# === NOVA LEADERBOARDS + STATE SLIMMING PATCH START ==="
BACKEND_END = "# === NOVA LEADERBOARDS + STATE SLIMMING PATCH END ==="
FRONTEND_MARKER = "// === NOVA LEADERBOARDS PAGE PATCH START ==="
FRONTEND_END = "// === NOVA LEADERBOARDS PAGE PATCH END ==="
CSS_MARKER = "/* === NOVA LEADERBOARDS PAGE PATCH START === */"
CSS_END = "/* === NOVA LEADERBOARDS PAGE PATCH END === */"
STATE_MARKER = "# NOVA_LEADERBOARD_STATE_FLAGS_PATCH"

def backup(path: Path):
    if path.exists():
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        shutil.copy2(path, path.with_suffix(path.suffix + f".bak_leaderboards_{stamp}"))

def replace_block(text: str, start: str, end: str, block: str) -> str:
    pattern = re.compile(re.escape(start) + r".*?" + re.escape(end), re.S)
    if pattern.search(text):
        return pattern.sub(block, text)
    return text + "\n\n" + block + "\n"

BACKEND_BLOCK = r'''
# === NOVA LEADERBOARDS + STATE SLIMMING PATCH START ===
# Performance-first leaderboard snapshots, compact metric rollups, guarded maintenance jobs,
# and state_versions/state_flags helpers. This block is intentionally self-contained so it can
# attach to the existing single-file Nova backend without requiring a framework rewrite.
import os as _nova_lb_os
import json as _nova_lb_json
import time as _nova_lb_time
import sqlite3 as _nova_lb_sqlite3
import traceback as _nova_lb_traceback
from datetime import datetime as _nova_lb_datetime, timezone as _nova_lb_timezone, timedelta as _nova_lb_timedelta, date as _nova_lb_date

_NOVA_LB_LAST_MAINTENANCE_CHECK = 0.0
_NOVA_LB_SCHEMA_READY_AT = 0.0
_NOVA_LB_DEFAULT_TOP_N = 100
_NOVA_LB_DAILY_REFRESH_SECONDS = int(_nova_lb_os.environ.get("NOVA_LEADERBOARD_REFRESH_SECONDS", "86400"))
_NOVA_LB_STRICT_STATE_SLIMMING = _nova_lb_os.environ.get("NOVA_STRICT_STATE_SLIMMING", "0") == "1"
_NOVA_LB_HEAVY_STATE_KEYS = {
    "leaderboards", "leaderboard_rows", "leaderboard_snapshots", "public_rankings",
    "world_statistics", "server_analytics", "admin_logs", "full_admin_logs",
    "chat_history", "chat_messages", "full_chat_messages", "guild_logs", "guild_history",
    "guild_armory", "market_history", "event_history", "achievement_details",
    "public_profiles_full", "profile_directory",
}
# Only removed when NOVA_STRICT_STATE_SLIMMING=1 because older frontend builds may still depend on it.
_NOVA_LB_STRICT_EXTRA_HEAVY_STATE_KEYS = {
    "public_profiles", "achievements", "events", "market", "guild", "messages", "mailbox",
}

_NOVA_LB_METRICS = [
    ("player_level", "Player Level", "Progression", "Highest player level reached.", "number", "desc", 1, 1, "progression"),
    ("total_xp", "Total XP", "Progression", "Total character XP earned.", "number", "desc", 1, 1, "progression"),
    ("skill_points_earned", "Skill Points Earned", "Progression", "Skill points earned.", "number", "desc", 1, 1, "progression"),
    ("achievement_points", "Achievement Points", "Progression", "Achievement points earned.", "number", "desc", 1, 1, "progression"),
    ("wealth_gold", "Wealth / Gold", "Economy", "Current or snapshotted gold wealth.", "currency", "desc", 1, 1, "economy"),
    ("gold_earned", "Gold Earned", "Economy", "Gold earned from validated gameplay.", "currency", "desc", 1, 1, "economy"),
    ("trade_profit", "Trading Profit", "Economy", "Net profit from validated trade loops.", "currency", "desc", 1, 1, "economy"),
    ("market_sales_value", "Market Sales Volume", "Economy", "Total value of market sales.", "currency", "desc", 1, 1, "economy"),
    ("market_purchase_value", "Market Purchases Volume", "Economy", "Total value of market purchases.", "currency", "desc", 1, 1, "economy"),
    ("resources_mined", "Resources Mined", "Mining", "Total resources mined.", "number", "desc", 1, 1, "mining"),
    ("rare_resources_mined", "Rare Resources Mined", "Mining", "Rare resources mined.", "number", "desc", 1, 1, "mining"),
    ("mining_missions_completed", "Mining Missions Completed", "Mining", "Mining missions completed.", "number", "desc", 1, 1, "mining"),
    ("mining_haul_value", "Highest / Total Mining Haul Value", "Mining", "Validated mining haul value.", "number", "desc", 1, 1, "mining"),
    ("materials_processed", "Materials Processed", "Processing", "Total materials processed/refined.", "number", "desc", 1, 1, "processing"),
    ("processing_output_value", "Processing Output Value", "Processing", "Total processing output value.", "number", "desc", 1, 1, "processing"),
    ("rare_output_generated", "Rare Output Generated", "Processing", "Rare processing output generated.", "number", "desc", 1, 1, "processing"),
    ("items_crafted", "Items Crafted", "Crafting", "Items crafted.", "number", "desc", 1, 1, "crafting"),
    ("ships_crafted", "Ships Crafted", "Crafting", "Ships crafted.", "number", "desc", 1, 1, "crafting"),
    ("equipment_crafted", "Equipment Crafted", "Crafting", "Equipment crafted.", "number", "desc", 1, 1, "crafting"),
    ("high_tier_crafts", "High-Tier Crafts", "Crafting", "High-tier crafts completed.", "number", "desc", 1, 1, "crafting"),
    ("crafting_value_created", "Crafting Value Created", "Crafting", "Validated crafting value created.", "number", "desc", 1, 1, "crafting"),
    ("npc_kills", "NPC Kills", "Combat", "NPCs defeated.", "number", "desc", 1, 1, "combat"),
    ("player_kills", "Player Kills", "Combat", "Players defeated.", "number", "desc", 1, 1, "combat"),
    ("damage_dealt", "Damage Dealt", "Combat", "Validated damage dealt.", "number", "desc", 1, 1, "combat"),
    ("damage_taken", "Damage Tanked", "Combat", "Validated damage taken/tanked.", "number", "desc", 1, 1, "combat"),
    ("battles_won", "Battles Won", "Combat", "Battles won.", "number", "desc", 1, 1, "combat"),
    ("battles_survived", "Battles Survived", "Combat", "Battles survived.", "number", "desc", 1, 1, "combat"),
    ("bounty_value_claimed", "Bounty Value Claimed", "Combat", "Bounty value claimed.", "currency", "desc", 1, 1, "combat"),
    ("missions_completed", "Missions Completed", "Missions", "Missions completed.", "number", "desc", 1, 1, "missions"),
    ("mission_reward_value", "Mission Rewards Earned", "Missions", "Mission reward value earned.", "currency", "desc", 1, 1, "missions"),
    ("event_participation", "Event Participation", "Missions", "Server event participation score.", "number", "desc", 1, 1, "missions"),
    ("distance_traveled", "Distance Traveled", "Exploration", "Travel distance completed.", "number", "desc", 1, 1, "exploration"),
    ("systems_visited", "Systems Visited", "Exploration", "Unique or scored system visits.", "number", "desc", 1, 1, "exploration"),
    ("galaxies_visited", "Galaxies Visited", "Exploration", "Unique or scored galaxy visits.", "number", "desc", 1, 1, "exploration"),
    ("anomalies_discovered", "Anomalies Discovered", "Exploration", "Anomalies discovered.", "number", "desc", 1, 1, "exploration"),
    ("salvage_sites_discovered", "Salvage Sites Discovered", "Exploration", "Salvage sites discovered.", "number", "desc", 1, 1, "exploration"),
    ("guild_contribution_xp", "Guild Contribution XP", "Guild / War", "Guild XP contributed.", "number", "desc", 1, 1, "guild"),
    ("materials_donated_to_guild", "Materials Donated to Guild", "Guild / War", "Guild material donation score.", "number", "desc", 1, 1, "guild"),
    ("treasury_donated", "Treasury Donated", "Guild / War", "Guild treasury donations.", "currency", "desc", 1, 1, "guild"),
    ("armory_deposits", "Armory Deposits", "Guild / War", "Guild armory deposit count/value.", "number", "desc", 1, 1, "guild"),
    ("war_score", "War Score", "Guild / War", "Validated war score.", "number", "desc", 1, 1, "war"),
    ("planet_capture_progress", "Planet Capture Progress", "Guild / War", "Planet capture progress contributed.", "number", "desc", 1, 1, "war"),
    ("defense_kills", "Defense Kills", "Guild / War", "Defense kills during valid defense events/wars.", "number", "desc", 1, 1, "war"),
    ("faction_contribution", "Faction Contribution", "Planet / Faction", "Faction contribution score.", "number", "desc", 1, 1, "faction"),
    ("planet_influence_gained", "Planet Influence Gained", "Planet / Faction", "Planet influence gained.", "number", "desc", 1, 1, "faction"),
    ("planet_defense_participation", "Planet Defense Participation", "Planet / Faction", "Planet defense participation score.", "number", "desc", 1, 1, "faction"),
    ("patrol_turret_defense", "Patrol/Turret Defense", "Planet / Faction", "Patrol/turret defense contribution.", "number", "desc", 1, 1, "faction"),
]

def _nova_lb_now_iso():
    return _nova_lb_datetime.now(_nova_lb_timezone.utc).replace(microsecond=0).isoformat()

def _nova_lb_today():
    return _nova_lb_datetime.now(_nova_lb_timezone.utc).date().isoformat()

def _nova_lb_conn():
    # Prefer existing connection helpers if this backend already has them.
    for name in ("get_db", "get_conn", "get_connection", "connect_db"):
        fn = globals().get(name)
        if callable(fn):
            try:
                conn = fn()
                if conn is not None:
                    try:
                        conn.row_factory = _nova_lb_sqlite3.Row
                    except Exception:
                        pass
                    return conn
            except TypeError:
                pass
            except Exception:
                pass
    existing = globals().get("conn") or globals().get("db")
    if isinstance(existing, _nova_lb_sqlite3.Connection):
        try:
            existing.row_factory = _nova_lb_sqlite3.Row
        except Exception:
            pass
        return existing
    db_path = globals().get("DB_PATH") or globals().get("DATABASE") or globals().get("DATABASE_PATH") or _nova_lb_os.environ.get("NOVA_DB_PATH") or "nova_frontiers.db"
    conn = _nova_lb_sqlite3.connect(db_path, timeout=30)
    conn.row_factory = _nova_lb_sqlite3.Row
    try:
        conn.execute("PRAGMA busy_timeout=30000")
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
    except Exception:
        pass
    return conn

def _nova_lb_close_if_standalone(conn):
    # Do not close framework-managed connections returned by get_db/get_conn.
    # Standalone sqlite connections created here are cheap enough to leave to request teardown if present.
    return None

def _nova_lb_table_exists(conn, table_name):
    try:
        row = conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table_name,)).fetchone()
        return bool(row)
    except Exception:
        return False

def _nova_lb_table_cols(conn, table_name):
    try:
        return {r[1] for r in conn.execute(f"PRAGMA table_info({table_name})").fetchall()}
    except Exception:
        return set()

def _nova_lb_first_col(conn, table_name, names, default=None):
    cols = _nova_lb_table_cols(conn, table_name)
    for name in names:
        if name in cols:
            return name
    return default

def _nova_lb_current_player(conn=None):
    for name in ("get_player", "current_player", "get_current_player", "require_player"):
        fn = globals().get(name)
        if callable(fn):
            try:
                player = fn()
                if player:
                    return dict(player) if not isinstance(player, dict) else player
            except TypeError:
                try:
                    player = fn(conn) if conn is not None else None
                    if player:
                        return dict(player) if not isinstance(player, dict) else player
                except Exception:
                    pass
            except Exception:
                pass
    try:
        from flask import session, request
        player_id = session.get("player_id") or session.get("user_id") or request.headers.get("X-Player-Id")
    except Exception:
        player_id = None
    if conn is not None and player_id and _nova_lb_table_exists(conn, "players"):
        id_col = _nova_lb_first_col(conn, "players", ["id", "player_id"], "id")
        try:
            row = conn.execute(f"SELECT * FROM players WHERE {id_col}=?", (player_id,)).fetchone()
            return dict(row) if row else None
        except Exception:
            return None
    return None

def _nova_lb_player_id(player):
    if not player:
        return None
    for key in ("id", "player_id", "userid", "user_id"):
        if key in player and player.get(key) is not None:
            return player.get(key)
    return None

def _nova_lb_is_admin(player):
    if not player:
        return False
    for key in ("is_admin", "admin", "isAdmin", "god_mode", "godmode"):
        if bool(player.get(key)):
            return True
    role = str(player.get("role") or player.get("account_type") or player.get("type") or "").lower()
    return role in {"admin", "administrator", "god", "godmode", "owner"}

def _nova_lb_player_name_expr(conn):
    if not _nova_lb_table_exists(conn, "players"):
        return "CAST(r.player_id AS TEXT)"
    cols = _nova_lb_table_cols(conn, "players")
    for col in ("display_name", "name", "username", "handle", "callsign"):
        if col in cols:
            return f"COALESCE(p.{col}, CAST(r.player_id AS TEXT))"
    return "CAST(r.player_id AS TEXT)"

def _nova_lb_players_id_col(conn):
    return _nova_lb_first_col(conn, "players", ["id", "player_id", "userid", "user_id"], "id")

def nova_ensure_leaderboard_schema(conn=None):
    global _NOVA_LB_SCHEMA_READY_AT
    now = _nova_lb_time.time()
    if conn is None and now - _NOVA_LB_SCHEMA_READY_AT < 60:
        return
    conn = conn or _nova_lb_conn()
    cur = conn.cursor()
    cur.executescript("""
    CREATE TABLE IF NOT EXISTS leaderboard_metric_definitions (
        metric_key TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT DEFAULT '',
        value_type TEXT DEFAULT 'number',
        sort_direction TEXT DEFAULT 'desc',
        enabled INTEGER DEFAULT 1,
        visible_to_players INTEGER DEFAULT 1,
        source_event_type TEXT DEFAULT '',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS player_metric_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER NOT NULL,
        faction_id INTEGER,
        guild_id INTEGER,
        planet_id INTEGER,
        metric_key TEXT NOT NULL,
        amount REAL NOT NULL,
        metadata_json TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS player_metric_daily_rollups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER NOT NULL,
        faction_id INTEGER,
        guild_id INTEGER,
        metric_key TEXT NOT NULL,
        metric_date TEXT NOT NULL,
        value REAL NOT NULL DEFAULT 0,
        event_count INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(player_id, metric_key, metric_date)
    );
    CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        metric_key TEXT NOT NULL,
        scope TEXT NOT NULL,
        faction_id INTEGER,
        period TEXT NOT NULL,
        period_start TEXT,
        period_end TEXT,
        generated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        next_refresh_at TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        generated_by TEXT DEFAULT 'system',
        is_current INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS leaderboard_snapshot_rows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_id INTEGER NOT NULL,
        rank INTEGER NOT NULL,
        player_id INTEGER NOT NULL,
        player_name TEXT,
        faction_id INTEGER,
        guild_id INTEGER,
        value REAL NOT NULL,
        secondary_value REAL,
        metadata_json TEXT,
        FOREIGN KEY(snapshot_id) REFERENCES leaderboard_snapshots(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS leaderboard_refresh_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        requested_by INTEGER,
        started_at TEXT,
        finished_at TEXT,
        error_message TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS maintenance_jobs (
        job_key TEXT PRIMARY KEY,
        last_run_at TEXT,
        next_run_at TEXT,
        interval_seconds INTEGER NOT NULL DEFAULT 86400,
        status TEXT NOT NULL DEFAULT 'idle',
        locked_until TEXT,
        last_error TEXT,
        manual_requested INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS nova_state_versions (
        version_key TEXT PRIMARY KEY,
        version_value INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS leaderboard_settings (
        setting_key TEXT PRIMARY KEY,
        setting_value TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_player_metric_events_metric_created ON player_metric_events(metric_key, created_at);
    CREATE INDEX IF NOT EXISTS idx_player_metric_events_player_metric_created ON player_metric_events(player_id, metric_key, created_at);
    CREATE INDEX IF NOT EXISTS idx_player_metric_events_faction_metric_created ON player_metric_events(faction_id, metric_key, created_at);
    CREATE INDEX IF NOT EXISTS idx_player_metric_rollups_metric_date ON player_metric_daily_rollups(metric_key, metric_date);
    CREATE INDEX IF NOT EXISTS idx_player_metric_rollups_player_metric_date ON player_metric_daily_rollups(player_id, metric_key, metric_date);
    CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_lookup ON leaderboard_snapshots(metric_key, scope, faction_id, period, is_current);
    CREATE INDEX IF NOT EXISTS idx_leaderboard_rows_snapshot_rank ON leaderboard_snapshot_rows(snapshot_id, rank);
    CREATE INDEX IF NOT EXISTS idx_leaderboard_rows_player ON leaderboard_snapshot_rows(player_id);
    """)
    cur.execute("INSERT OR IGNORE INTO leaderboard_settings(setting_key, setting_value) VALUES('top_n', ?)", (str(_NOVA_LB_DEFAULT_TOP_N),))
    cur.execute("INSERT OR IGNORE INTO leaderboard_settings(setting_key, setting_value) VALUES('refresh_seconds', ?)", (str(_NOVA_LB_DAILY_REFRESH_SECONDS),))
    for metric in _NOVA_LB_METRICS:
        cur.execute("""
            INSERT OR IGNORE INTO leaderboard_metric_definitions
                (metric_key, display_name, category, description, value_type, sort_direction, enabled, visible_to_players, source_event_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, metric)
    for key, interval in (
        ("leaderboard_daily_refresh", 86400),
        ("leaderboard_weekly_refresh", 86400),
        ("leaderboard_all_time_refresh", 86400),
        ("market_summary_refresh", 3600),
        ("faction_summary_refresh", 3600),
        ("galaxy_security_balance", 600),
        ("npc_spawn_balance", 600),
        ("server_event_summary", 300),
        ("stale_cleanup", 900),
        ("achievement_summary_refresh", 86400),
    ):
        cur.execute("""
            INSERT OR IGNORE INTO maintenance_jobs(job_key, interval_seconds, status, next_run_at, updated_at)
            VALUES (?, ?, 'idle', ?, ?)
        """, (key, interval, _nova_lb_now_iso(), _nova_lb_now_iso()))
    conn.commit()
    _NOVA_LB_SCHEMA_READY_AT = now

def nova_bump_state_version(conn, version_key):
    try:
        nova_ensure_leaderboard_schema(conn)
        conn.execute("""
            INSERT INTO nova_state_versions(version_key, version_value, updated_at)
            VALUES(?, 1, ?)
            ON CONFLICT(version_key) DO UPDATE SET
                version_value = version_value + 1,
                updated_at = excluded.updated_at
        """, (version_key, _nova_lb_now_iso()))
    except Exception:
        pass

def _nova_lb_get_setting(conn, key, default):
    try:
        row = conn.execute("SELECT setting_value FROM leaderboard_settings WHERE setting_key=?", (key,)).fetchone()
        return row[0] if row else default
    except Exception:
        return default

def record_player_metric(conn, player_id, metric_key, amount, faction_id=None, guild_id=None, planet_id=None, metadata=None):
    return nova_record_player_metric(conn, player_id, metric_key, amount, faction_id, guild_id, planet_id, metadata)

def nova_record_player_metric(conn, player_id, metric_key, amount, faction_id=None, guild_id=None, planet_id=None, metadata=None):
    """Server-side metric hook. Call this from validated gameplay actions only."""
    try:
        nova_ensure_leaderboard_schema(conn)
        if not player_id or metric_key is None:
            return False
        amount = float(amount)
        if amount <= 0:
            return False
        row = conn.execute("SELECT enabled FROM leaderboard_metric_definitions WHERE metric_key=?", (metric_key,)).fetchone()
        if not row or int(row[0]) != 1:
            return False
        if (faction_id is None or guild_id is None) and _nova_lb_table_exists(conn, "players"):
            id_col = _nova_lb_players_id_col(conn)
            cols = _nova_lb_table_cols(conn, "players")
            select_cols = []
            if "faction_id" in cols:
                select_cols.append("faction_id")
            elif "faction" in cols:
                select_cols.append("faction")
            if "guild_id" in cols:
                select_cols.append("guild_id")
            if select_cols:
                prow = conn.execute(f"SELECT {', '.join(select_cols)} FROM players WHERE {id_col}=?", (player_id,)).fetchone()
                if prow:
                    pd = dict(prow)
                    faction_id = faction_id if faction_id is not None else pd.get("faction_id", pd.get("faction"))
                    guild_id = guild_id if guild_id is not None else pd.get("guild_id")
        metadata_json = _nova_lb_json.dumps(metadata or {}, separators=(",", ":"))[:2000]
        now_iso = _nova_lb_now_iso()
        metric_date = _nova_lb_today()
        conn.execute("""
            INSERT INTO player_metric_events(player_id, faction_id, guild_id, planet_id, metric_key, amount, metadata_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (player_id, faction_id, guild_id, planet_id, metric_key, amount, metadata_json, now_iso))
        conn.execute("""
            INSERT INTO player_metric_daily_rollups(player_id, faction_id, guild_id, metric_key, metric_date, value, event_count, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?)
            ON CONFLICT(player_id, metric_key, metric_date) DO UPDATE SET
                value = value + excluded.value,
                event_count = event_count + 1,
                faction_id = COALESCE(excluded.faction_id, faction_id),
                guild_id = COALESCE(excluded.guild_id, guild_id),
                updated_at = excluded.updated_at
        """, (player_id, faction_id, guild_id, metric_key, metric_date, amount, now_iso))
        nova_bump_state_version(conn, "leaderboards")
        return True
    except Exception as exc:
        try:
            print("[leaderboards] metric write failed", metric_key, exc)
        except Exception:
            pass
        return False

def _nova_lb_period_bounds(period):
    now = _nova_lb_datetime.now(_nova_lb_timezone.utc)
    today = now.date()
    if period == "daily":
        start = today
        end = today
    elif period == "weekly":
        start = today - _nova_lb_timedelta(days=today.weekday())
        end = today
    elif period == "monthly":
        start = today.replace(day=1)
        end = today
    elif period in ("all_time", "all-time", "all"):
        start = _nova_lb_date(1970, 1, 1)
        end = today
        period = "all_time"
    else:
        start = today
        end = today
        period = "daily"
    return period, start.isoformat(), end.isoformat()

def nova_generate_leaderboard_snapshot(conn, metric_key, scope="global", period="daily", faction_id=None, top_n=None, generated_by="system"):
    nova_ensure_leaderboard_schema(conn)
    period, start, end = _nova_lb_period_bounds(period)
    scope = scope if scope in {"global", "faction"} else "global"
    if scope == "global":
        faction_id = None
    try:
        top_n = int(top_n or _nova_lb_get_setting(conn, "top_n", _NOVA_LB_DEFAULT_TOP_N))
    except Exception:
        top_n = _NOVA_LB_DEFAULT_TOP_N
    top_n = max(1, min(top_n, 500))
    metric = conn.execute("SELECT * FROM leaderboard_metric_definitions WHERE metric_key=? AND enabled=1", (metric_key,)).fetchone()
    if not metric:
        return None
    players_join = ""
    player_name = "CAST(r.player_id AS TEXT)"
    id_col = "id"
    if _nova_lb_table_exists(conn, "players"):
        id_col = _nova_lb_players_id_col(conn)
        players_join = f"LEFT JOIN players p ON p.{id_col}=r.player_id"
        player_name = _nova_lb_player_name_expr(conn)
    where = "r.metric_key=? AND r.metric_date>=? AND r.metric_date<=?"
    params = [metric_key, start, end]
    if scope == "faction":
        where += " AND r.faction_id=?"
        params.append(faction_id)
    rows = conn.execute(f"""
        SELECT r.player_id,
               {player_name} AS player_name,
               MAX(r.faction_id) AS faction_id,
               MAX(r.guild_id) AS guild_id,
               SUM(r.value) AS value,
               SUM(r.event_count) AS secondary_value
        FROM player_metric_daily_rollups r
        {players_join}
        WHERE {where}
        GROUP BY r.player_id
        HAVING value > 0
        ORDER BY value DESC, secondary_value DESC
        LIMIT ?
    """, tuple(params + [top_n])).fetchall()
    old = conn.execute("SELECT COALESCE(MAX(version), 0) FROM leaderboard_snapshots WHERE metric_key=? AND scope=? AND COALESCE(faction_id, -1)=COALESCE(?, -1) AND period=?", (metric_key, scope, faction_id, period)).fetchone()[0]
    version = int(old or 0) + 1
    now_iso = _nova_lb_now_iso()
    next_iso = (_nova_lb_datetime.now(_nova_lb_timezone.utc) + _nova_lb_timedelta(seconds=int(_nova_lb_get_setting(conn, "refresh_seconds", _NOVA_LB_DAILY_REFRESH_SECONDS)))).replace(microsecond=0).isoformat()
    conn.execute("UPDATE leaderboard_snapshots SET is_current=0 WHERE metric_key=? AND scope=? AND COALESCE(faction_id, -1)=COALESCE(?, -1) AND period=?", (metric_key, scope, faction_id, period))
    cur = conn.execute("""
        INSERT INTO leaderboard_snapshots(metric_key, scope, faction_id, period, period_start, period_end, generated_at, next_refresh_at, version, generated_by, is_current)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    """, (metric_key, scope, faction_id, period, start, end, now_iso, next_iso, version, str(generated_by or "system")))
    snapshot_id = cur.lastrowid
    for index, row in enumerate(rows, start=1):
        conn.execute("""
            INSERT INTO leaderboard_snapshot_rows(snapshot_id, rank, player_id, player_name, faction_id, guild_id, value, secondary_value, metadata_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (snapshot_id, index, row["player_id"], row["player_name"], row["faction_id"], row["guild_id"], row["value"], row["secondary_value"], "{}"))
    nova_bump_state_version(conn, "leaderboards")
    return snapshot_id

def nova_generate_leaderboards(conn, metric_key=None, scope=None, faction_id=None, period=None, generated_by="system"):
    nova_ensure_leaderboard_schema(conn)
    metric_rows = conn.execute("SELECT metric_key FROM leaderboard_metric_definitions WHERE enabled=1 AND visible_to_players=1" + (" AND metric_key=?" if metric_key else ""), ((metric_key,) if metric_key else ())).fetchall()
    periods = [period] if period else ["daily", "weekly", "all_time"]
    scopes = [scope] if scope else ["global", "faction"]
    faction_ids = []
    if faction_id is not None:
        faction_ids = [faction_id]
    else:
        try:
            faction_ids = [r[0] for r in conn.execute("SELECT DISTINCT faction_id FROM player_metric_daily_rollups WHERE faction_id IS NOT NULL").fetchall()]
        except Exception:
            faction_ids = []
    made = 0
    errors = []
    for m in metric_rows:
        mk = m[0]
        for per in periods:
            for sc in scopes:
                if sc == "global":
                    try:
                        if nova_generate_leaderboard_snapshot(conn, mk, "global", per, None, generated_by=generated_by):
                            made += 1
                    except Exception as exc:
                        errors.append(f"{mk}/global/{per}: {exc}")
                elif sc == "faction":
                    for fid in faction_ids:
                        try:
                            if nova_generate_leaderboard_snapshot(conn, mk, "faction", per, fid, generated_by=generated_by):
                                made += 1
                        except Exception as exc:
                            errors.append(f"{mk}/faction/{fid}/{per}: {exc}")
    conn.commit()
    return {"generated": made, "errors": errors[:20]}

def nova_should_run_job(conn, job_key, interval_seconds):
    nova_ensure_leaderboard_schema(conn)
    now = _nova_lb_datetime.now(_nova_lb_timezone.utc)
    now_iso = now.replace(microsecond=0).isoformat()
    locked_cutoff = now_iso
    row = conn.execute("SELECT * FROM maintenance_jobs WHERE job_key=?", (job_key,)).fetchone()
    if not row:
        conn.execute("INSERT OR IGNORE INTO maintenance_jobs(job_key, interval_seconds, status, next_run_at, updated_at) VALUES (?, ?, 'idle', ?, ?)", (job_key, interval_seconds, now_iso, now_iso))
        row = conn.execute("SELECT * FROM maintenance_jobs WHERE job_key=?", (job_key,)).fetchone()
    if row["status"] == "running" and row["locked_until"] and row["locked_until"] > locked_cutoff:
        return False
    manual = int(row["manual_requested"] or 0) == 1
    due = manual or not row["next_run_at"] or row["next_run_at"] <= now_iso
    if not due:
        return False
    lock_until = (now + _nova_lb_timedelta(minutes=5)).replace(microsecond=0).isoformat()
    conn.execute("UPDATE maintenance_jobs SET status='running', locked_until=?, manual_requested=0, updated_at=? WHERE job_key=?", (lock_until, now_iso, job_key))
    conn.commit()
    return True

def nova_mark_job_finished(conn, job_key, interval_seconds, error=None):
    now = _nova_lb_datetime.now(_nova_lb_timezone.utc)
    now_iso = now.replace(microsecond=0).isoformat()
    next_iso = (now + _nova_lb_timedelta(seconds=int(interval_seconds))).replace(microsecond=0).isoformat()
    conn.execute("""
        UPDATE maintenance_jobs
        SET status=?, last_run_at=?, next_run_at=?, locked_until=NULL, last_error=?, updated_at=?
        WHERE job_key=?
    """, ("error" if error else "idle", now_iso, next_iso, str(error)[:1000] if error else None, now_iso, job_key))
    conn.commit()

def nova_request_manual_job(conn, job_key, requested_by=None):
    nova_ensure_leaderboard_schema(conn)
    conn.execute("""
        INSERT INTO maintenance_jobs(job_key, interval_seconds, manual_requested, status, updated_at)
        VALUES(?, 86400, 1, 'idle', ?)
        ON CONFLICT(job_key) DO UPDATE SET manual_requested=1, updated_at=excluded.updated_at
    """, (job_key, _nova_lb_now_iso()))
    conn.execute("INSERT INTO leaderboard_refresh_jobs(job_type, status, requested_by, created_at) VALUES (?, 'queued', ?, ?)", (job_key, requested_by, _nova_lb_now_iso()))
    conn.commit()

def nova_run_due_maintenance(max_jobs=1):
    conn = _nova_lb_conn()
    ran = 0
    for job_key, interval in (("leaderboard_daily_refresh", 86400), ("leaderboard_weekly_refresh", 86400), ("leaderboard_all_time_refresh", 86400)):
        if ran >= max_jobs:
            break
        if not nova_should_run_job(conn, job_key, interval):
            continue
        error = None
        try:
            period = "daily" if "daily" in job_key else ("weekly" if "weekly" in job_key else "all_time")
            nova_generate_leaderboards(conn, period=period, generated_by="maintenance")
            ran += 1
        except Exception as exc:
            error = exc
            try:
                print("[leaderboards] maintenance failed", job_key, exc)
                print(_nova_lb_traceback.format_exc())
            except Exception:
                pass
        finally:
            nova_mark_job_finished(conn, job_key, interval, error)
    return ran

def nova_leaderboard_state_versions(conn=None, player=None):
    conn = conn or _nova_lb_conn()
    try:
        nova_ensure_leaderboard_schema(conn)
        def version(key):
            row = conn.execute("SELECT version_value FROM nova_state_versions WHERE version_key=?", (key,)).fetchone()
            return int(row[0]) if row else 1
        latest_lb = conn.execute("SELECT COALESCE(MAX(version), 1) FROM leaderboard_snapshots WHERE is_current=1").fetchone()[0]
        result = {
            "leaderboards": int(latest_lb or version("leaderboards")),
            "guild_summary": version("guild_summary"),
            "chat_global": version("chat_global"),
            "chat_faction": version("chat_faction"),
            "messages_unread": version("messages_unread"),
            "market_summary": version("market_summary"),
            "events_summary": version("events_summary"),
            "profile": version("profile"),
            "achievements": version("achievements"),
            "admin_alerts": version("admin_alerts"),
        }
        return result
    except Exception:
        return {"leaderboards": 1}

def nova_leaderboard_state_flags(conn=None, player=None):
    conn = conn or _nova_lb_conn()
    player = player or _nova_lb_current_player(conn)
    player_id = _nova_lb_player_id(player)
    flags = {
        "has_unread_messages": False,
        "has_active_battle": False,
        "has_active_war": False,
        "has_pending_guild_invite": False,
        "guild_data_stale": False,
        "leaderboards_stale": False,
        "event_page_stale": False,
    }
    try:
        if player_id and _nova_lb_table_exists(conn, "guild_invites"):
            cols = _nova_lb_table_cols(conn, "guild_invites")
            recipient_col = _nova_lb_first_col(conn, "guild_invites", ["player_id", "recipient_player_id", "invitee_id"], None)
            status_col = _nova_lb_first_col(conn, "guild_invites", ["status", "state"], None)
            if recipient_col:
                sql = f"SELECT 1 FROM guild_invites WHERE {recipient_col}=?"
                params = [player_id]
                if status_col:
                    sql += f" AND {status_col} IN ('pending','open','sent')"
                flags["has_pending_guild_invite"] = bool(conn.execute(sql + " LIMIT 1", tuple(params)).fetchone())
        if _nova_lb_table_exists(conn, "leaderboard_snapshots"):
            refresh_seconds = int(_nova_lb_get_setting(conn, "refresh_seconds", _NOVA_LB_DAILY_REFRESH_SECONDS))
            stale_cutoff = (_nova_lb_datetime.now(_nova_lb_timezone.utc) - _nova_lb_timedelta(seconds=refresh_seconds + 3600)).replace(microsecond=0).isoformat()
            row = conn.execute("SELECT 1 FROM leaderboard_snapshots WHERE is_current=1 AND generated_at < ? LIMIT 1", (stale_cutoff,)).fetchone()
            flags["leaderboards_stale"] = bool(row)
    except Exception:
        pass
    return flags

def nova_slim_state_payload(state, conn=None, player=None):
    if not isinstance(state, dict):
        return state
    conn = conn or _nova_lb_conn()
    state.setdefault("state_versions", nova_leaderboard_state_versions(conn, player))
    state.setdefault("state_flags", nova_leaderboard_state_flags(conn, player))
    deferred = state.setdefault("deferred_sections", {})
    keys = set(_NOVA_LB_HEAVY_STATE_KEYS)
    if _NOVA_LB_STRICT_STATE_SLIMMING:
        keys |= _NOVA_LB_STRICT_EXTRA_HEAVY_STATE_KEYS
    for key in list(keys):
        if key not in state:
            continue
        value = state.get(key)
        count = len(value) if hasattr(value, "__len__") and not isinstance(value, (str, bytes)) else None
        endpoint = {
            "leaderboards": "/api/leaderboards",
            "chat_history": "/api/chat/messages",
            "chat_messages": "/api/chat/messages",
            "guild_logs": "/api/guild/logs",
            "guild_armory": "/api/guild/armory",
            "market_history": "/api/market/history",
            "event_history": "/api/events",
            "achievement_details": "/api/achievements",
            "public_profiles": "/api/profile/public-profiles",
        }.get(key)
        deferred[key] = {"count": count, "endpoint": endpoint, "reason": "not_hot_path"}
        del state[key]
    return state

def nova_leaderboard_summary_payload(conn, player=None):
    nova_ensure_leaderboard_schema(conn)
    player = player or _nova_lb_current_player(conn)
    rows = conn.execute("SELECT * FROM leaderboard_metric_definitions WHERE enabled=1 AND visible_to_players=1 ORDER BY category, display_name").fetchall()
    metrics = [dict(r) for r in rows]
    categories = []
    seen = set()
    for m in metrics:
        cat = m.get("category")
        if cat not in seen:
            seen.add(cat)
            categories.append(cat)
    latest = conn.execute("SELECT MAX(generated_at) AS generated_at, MAX(next_refresh_at) AS next_refresh_at, COALESCE(MAX(version), 1) AS version FROM leaderboard_snapshots WHERE is_current=1").fetchone()
    current_faction = None
    if player:
        current_faction = player.get("faction_id", player.get("faction"))
    return {
        "metrics": metrics,
        "categories": categories,
        "current_faction_id": current_faction,
        "snapshot_version": int((latest and latest["version"]) or 1),
        "last_generated_at": (latest and latest["generated_at"]) or None,
        "next_refresh_at": (latest and latest["next_refresh_at"]) or None,
        "is_admin": _nova_lb_is_admin(player),
        "state_versions": nova_leaderboard_state_versions(conn, player),
    }

def nova_api_json(payload, status=200):
    try:
        from flask import jsonify
        return jsonify(payload), status
    except Exception:
        return payload

try:
    _nova_lb_app = globals().get("app")
    if _nova_lb_app is not None and not getattr(_nova_lb_app, "_nova_leaderboards_routes_registered", False):
        @_nova_lb_app.route("/api/leaderboards/summary", methods=["GET"])
        def nova_api_leaderboard_summary():
            conn = _nova_lb_conn()
            player = _nova_lb_current_player(conn)
            return nova_api_json(nova_leaderboard_summary_payload(conn, player))

        @_nova_lb_app.route("/api/leaderboards", methods=["GET"])
        def nova_api_leaderboards():
            from flask import request
            conn = _nova_lb_conn()
            player = _nova_lb_current_player(conn)
            nova_ensure_leaderboard_schema(conn)
            metric_key = request.args.get("metric_key") or "player_level"
            scope = request.args.get("scope") or "global"
            period = request.args.get("period") or "daily"
            limit = max(1, min(int(request.args.get("limit") or _nova_lb_get_setting(conn, "top_n", _NOVA_LB_DEFAULT_TOP_N)), 500))
            faction_id = request.args.get("faction_id")
            if scope == "faction" and not faction_id and player:
                faction_id = player.get("faction_id", player.get("faction"))
            try:
                faction_id = int(faction_id) if faction_id not in (None, "", "None") else None
            except Exception:
                faction_id = None
            snap = conn.execute("""
                SELECT * FROM leaderboard_snapshots
                WHERE metric_key=? AND scope=? AND COALESCE(faction_id, -1)=COALESCE(?, -1) AND period=? AND is_current=1
                ORDER BY generated_at DESC, id DESC LIMIT 1
            """, (metric_key, scope, faction_id, period)).fetchone()
            if not snap:
                # Bounded first-view generation only for the selected metric/scope/period. Full rebuilds are admin/maintenance only.
                nova_generate_leaderboard_snapshot(conn, metric_key, scope, period, faction_id, generated_by="first_view")
                conn.commit()
                snap = conn.execute("""
                    SELECT * FROM leaderboard_snapshots
                    WHERE metric_key=? AND scope=? AND COALESCE(faction_id, -1)=COALESCE(?, -1) AND period=? AND is_current=1
                    ORDER BY generated_at DESC, id DESC LIMIT 1
                """, (metric_key, scope, faction_id, period)).fetchone()
            metric = conn.execute("SELECT * FROM leaderboard_metric_definitions WHERE metric_key=?", (metric_key,)).fetchone()
            rows = []
            if snap:
                rows = [dict(r) for r in conn.execute("SELECT * FROM leaderboard_snapshot_rows WHERE snapshot_id=? ORDER BY rank LIMIT ?", (snap["id"], limit)).fetchall()]
            refresh_seconds = int(_nova_lb_get_setting(conn, "refresh_seconds", _NOVA_LB_DAILY_REFRESH_SECONDS))
            stale = False
            if snap and snap["generated_at"]:
                try:
                    gen = _nova_lb_datetime.fromisoformat(str(snap["generated_at"]).replace("Z", "+00:00"))
                    stale = (_nova_lb_datetime.now(_nova_lb_timezone.utc) - gen).total_seconds() > refresh_seconds + 3600
                except Exception:
                    stale = False
            return nova_api_json({
                "metric": dict(metric) if metric else None,
                "scope": scope,
                "faction_id": faction_id,
                "period": period,
                "generated_at": snap["generated_at"] if snap else None,
                "next_refresh_at": snap["next_refresh_at"] if snap else None,
                "stale": stale,
                "version": int(snap["version"]) if snap else 1,
                "rows": rows,
                "current_player_id": _nova_lb_player_id(player),
            })

        @_nova_lb_app.route("/api/leaderboards/player", methods=["GET"])
        def nova_api_leaderboard_player():
            from flask import request
            conn = _nova_lb_conn()
            player = _nova_lb_current_player(conn)
            player_id = request.args.get("player_id") or _nova_lb_player_id(player)
            period = request.args.get("period") or "daily"
            if not player_id:
                return nova_api_json({"error": "player_id required"}, 400)
            rows = conn.execute("""
                SELECT s.metric_key, s.scope, s.faction_id, s.period, s.generated_at, r.rank, r.value, r.secondary_value
                FROM leaderboard_snapshot_rows r
                JOIN leaderboard_snapshots s ON s.id=r.snapshot_id
                WHERE r.player_id=? AND s.period=? AND s.is_current=1
                ORDER BY s.metric_key, s.scope
            """, (player_id, period)).fetchall()
            return nova_api_json({"player_id": player_id, "period": period, "ranks": [dict(r) for r in rows]})

        @_nova_lb_app.route("/api/admin/leaderboards/refresh", methods=["POST"])
        def nova_api_admin_leaderboard_refresh():
            from flask import request
            conn = _nova_lb_conn()
            player = _nova_lb_current_player(conn)
            if not _nova_lb_is_admin(player):
                return nova_api_json({"error": "admin required"}, 403)
            data = request.get_json(silent=True) or {}
            conn.execute("INSERT INTO leaderboard_refresh_jobs(job_type, status, requested_by, started_at, created_at) VALUES('manual_refresh', 'running', ?, ?, ?)", (_nova_lb_player_id(player), _nova_lb_now_iso(), _nova_lb_now_iso()))
            job_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
            error = None
            try:
                result = nova_generate_leaderboards(conn, metric_key=data.get("metric_key"), scope=data.get("scope"), faction_id=data.get("faction_id"), period=data.get("period"), generated_by=f"admin:{_nova_lb_player_id(player)}")
                conn.execute("UPDATE leaderboard_refresh_jobs SET status='finished', finished_at=? WHERE id=?", (_nova_lb_now_iso(), job_id))
                conn.commit()
                return nova_api_json({"ok": True, **result})
            except Exception as exc:
                error = str(exc)
                conn.execute("UPDATE leaderboard_refresh_jobs SET status='error', finished_at=?, error_message=? WHERE id=?", (_nova_lb_now_iso(), error[:1000], job_id))
                conn.commit()
                return nova_api_json({"ok": False, "error": error}, 500)

        @_nova_lb_app.route("/api/admin/leaderboards/settings", methods=["POST"])
        def nova_api_admin_leaderboard_settings():
            from flask import request
            conn = _nova_lb_conn()
            player = _nova_lb_current_player(conn)
            if not _nova_lb_is_admin(player):
                return nova_api_json({"error": "admin required"}, 403)
            data = request.get_json(silent=True) or {}
            for key in ("top_n", "refresh_seconds"):
                if key in data:
                    conn.execute("INSERT INTO leaderboard_settings(setting_key, setting_value, updated_at) VALUES(?, ?, ?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value, updated_at=excluded.updated_at", (key, str(data[key]), _nova_lb_now_iso()))
            if "metric_key" in data and "enabled" in data:
                conn.execute("UPDATE leaderboard_metric_definitions SET enabled=? WHERE metric_key=?", (1 if data.get("enabled") else 0, data.get("metric_key")))
            nova_bump_state_version(conn, "leaderboards")
            conn.commit()
            return nova_api_json({"ok": True})

        @_nova_lb_app.route("/api/admin/maintenance/jobs", methods=["GET"])
        def nova_api_admin_maintenance_jobs():
            conn = _nova_lb_conn()
            player = _nova_lb_current_player(conn)
            if not _nova_lb_is_admin(player):
                return nova_api_json({"error": "admin required"}, 403)
            nova_ensure_leaderboard_schema(conn)
            jobs = [dict(r) for r in conn.execute("SELECT * FROM maintenance_jobs ORDER BY job_key").fetchall()]
            refresh_jobs = [dict(r) for r in conn.execute("SELECT * FROM leaderboard_refresh_jobs ORDER BY id DESC LIMIT 25").fetchall()]
            return nova_api_json({"jobs": jobs, "leaderboard_refresh_jobs": refresh_jobs})

        @_nova_lb_app.route("/api/admin/maintenance/run", methods=["POST"])
        def nova_api_admin_maintenance_run():
            from flask import request
            conn = _nova_lb_conn()
            player = _nova_lb_current_player(conn)
            if not _nova_lb_is_admin(player):
                return nova_api_json({"error": "admin required"}, 403)
            data = request.get_json(silent=True) or {}
            job_key = data.get("job_key") or "leaderboard_daily_refresh"
            nova_request_manual_job(conn, job_key, _nova_lb_player_id(player))
            return nova_api_json({"ok": True, "job_key": job_key})

        @_nova_lb_app.route("/api/admin/state/debug", methods=["GET"])
        def nova_api_admin_state_debug():
            conn = _nova_lb_conn()
            player = _nova_lb_current_player(conn)
            if not _nova_lb_is_admin(player):
                return nova_api_json({"error": "admin required"}, 403)
            payload = {}
            try:
                if callable(globals().get("build_state")):
                    payload = globals()["build_state"]()
            except Exception as exc:
                return nova_api_json({"error": str(exc)}, 500)
            sizes = []
            for key, val in (payload or {}).items():
                try:
                    raw = _nova_lb_json.dumps(val, default=str)
                    sizes.append({"key": key, "bytes": len(raw), "count": len(val) if hasattr(val, "__len__") and not isinstance(val, (str, bytes)) else None})
                except Exception:
                    sizes.append({"key": key, "bytes": None, "count": None})
            sizes.sort(key=lambda x: x["bytes"] or 0, reverse=True)
            return nova_api_json({"total_bytes": sum(x["bytes"] or 0 for x in sizes), "sections": sizes[:50], "strict_state_slimming": _NOVA_LB_STRICT_STATE_SLIMMING})

        try:
            @_nova_lb_app.before_request
            def nova_leaderboard_lightweight_maintenance_tick():
                global _NOVA_LB_LAST_MAINTENANCE_CHECK
                try:
                    from flask import request
                    if request.path.startswith("/api/state"):
                        return None
                    now = _nova_lb_time.time()
                    if now - _NOVA_LB_LAST_MAINTENANCE_CHECK < 60:
                        return None
                    _NOVA_LB_LAST_MAINTENANCE_CHECK = now
                    nova_run_due_maintenance(max_jobs=1)
                except Exception:
                    return None
                return None
        except Exception:
            pass

        setattr(_nova_lb_app, "_nova_leaderboards_routes_registered", True)
except Exception as _nova_lb_route_exc:
    try:
        print("[leaderboards] route registration skipped", _nova_lb_route_exc)
    except Exception:
        pass
# === NOVA LEADERBOARDS + STATE SLIMMING PATCH END ===
'''

FRONTEND_BLOCK = r'''
// === NOVA LEADERBOARDS PAGE PATCH START ===
(function novaInstallLeaderboardsPage(){
  if (typeof window === "undefined" || window.__novaLeaderboardsInstalled) return;
  window.__novaLeaderboardsInstalled = true;
  const api = async (url, opts = {}) => {
    const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
    const res = await fetch(url, { credentials: "include", ...opts, headers });
    let data = null;
    try { data = await res.json(); } catch (_) { data = {}; }
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  };
  const state = {
    open: false,
    summary: null,
    board: null,
    scope: "global",
    category: "Progression",
    metric: "player_level",
    period: "daily",
    lastVersion: null,
    loading: false,
    error: ""
  };
  function esc(v){ return String(v ?? "").replace(/[&<>"']/g, s => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[s])); }
  function fmt(v){
    const n = Number(v || 0);
    if (!Number.isFinite(n)) return esc(v);
    if (Math.abs(n) >= 1000000) return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
    if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
    return n.toLocaleString(undefined, { maximumFractionDigits: n % 1 ? 2 : 0 });
  }
  function root(){
    let el = document.getElementById("nova-leaderboards-root");
    if (!el) {
      el = document.createElement("div");
      el.id = "nova-leaderboards-root";
      document.body.appendChild(el);
    }
    return el;
  }
  function selectedMetrics(){
    const metrics = state.summary?.metrics || [];
    return metrics.filter(m => !state.category || m.category === state.category);
  }
  function render(){
    const el = root();
    const categories = state.summary?.categories || [];
    const metrics = selectedMetrics();
    const rows = state.board?.rows || [];
    el.innerHTML = `
      <button class="nova-lb-launcher" type="button" title="Leaderboards">🏆</button>
      <section class="nova-lb-panel ${state.open ? "open" : ""}" aria-hidden="${state.open ? "false" : "true"}">
        <div class="nova-lb-head">
          <div>
            <strong>Leaderboards</strong>
            <span>${state.board?.generated_at ? `Updated ${esc(new Date(state.board.generated_at).toLocaleString())}` : "Daily snapshots"}</span>
          </div>
          <button class="nova-lb-close" type="button">×</button>
        </div>
        <div class="nova-lb-tabs">
          <button class="${state.scope === "global" ? "active" : ""}" data-lb-scope="global" type="button">Global</button>
          <button class="${state.scope === "faction" ? "active" : ""}" data-lb-scope="faction" type="button">Faction</button>
        </div>
        <div class="nova-lb-filters">
          <label>Category<select id="nova-lb-category">${categories.map(c => `<option value="${esc(c)}" ${c === state.category ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
          <label>Metric<select id="nova-lb-metric">${metrics.map(m => `<option value="${esc(m.metric_key)}" ${m.metric_key === state.metric ? "selected" : ""}>${esc(m.display_name)}</option>`).join("")}</select></label>
          <label>Period<select id="nova-lb-period">
            <option value="daily" ${state.period === "daily" ? "selected" : ""}>Daily</option>
            <option value="weekly" ${state.period === "weekly" ? "selected" : ""}>Weekly</option>
            <option value="monthly" ${state.period === "monthly" ? "selected" : ""}>Monthly</option>
            <option value="all_time" ${state.period === "all_time" ? "selected" : ""}>All-time</option>
          </select></label>
          ${state.summary?.is_admin ? `<button class="nova-lb-refresh" type="button">Manual Refresh</button>` : ""}
        </div>
        ${state.error ? `<div class="nova-lb-error">${esc(state.error)}</div>` : ""}
        ${state.loading ? `<div class="nova-lb-loading">Loading leaderboard…</div>` : ""}
        <div class="nova-lb-meta">
          <span>Scope: ${esc(state.scope)}</span>
          <span>Next: ${state.board?.next_refresh_at ? esc(new Date(state.board.next_refresh_at).toLocaleString()) : "scheduled"}</span>
          ${state.board?.stale ? `<b>STALE</b>` : ""}
        </div>
        <div class="nova-lb-table-wrap">
          <table class="nova-lb-table">
            <thead><tr><th>#</th><th>Player</th><th>Faction</th><th>Guild</th><th>Value</th><th>Events</th></tr></thead>
            <tbody>
              ${rows.length ? rows.map(r => `<tr class="${String(r.player_id) === String(state.board?.current_player_id) ? "me" : ""}"><td>${esc(r.rank)}</td><td>${esc(r.player_name || r.player_id)}</td><td>${esc(r.faction_id || "—")}</td><td>${esc(r.guild_id || "—")}</td><td>${fmt(r.value)}</td><td>${fmt(r.secondary_value)}</td></tr>`).join("") : `<tr><td colspan="6" class="nova-lb-empty">No snapshot data yet. Metrics appear after validated gameplay events are recorded and snapshots refresh.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `;
    el.querySelector(".nova-lb-launcher")?.addEventListener("click", () => openPage());
    el.querySelector(".nova-lb-close")?.addEventListener("click", () => { state.open = false; if (location.hash === "#leaderboards") history.replaceState(null, "", location.pathname + location.search); render(); });
    el.querySelectorAll("[data-lb-scope]").forEach(btn => btn.addEventListener("click", () => { state.scope = btn.dataset.lbScope; loadBoard(); }));
    el.querySelector("#nova-lb-category")?.addEventListener("change", e => { state.category = e.target.value; const first = (state.summary?.metrics || []).find(m => m.category === state.category); if (first) state.metric = first.metric_key; loadBoard(); });
    el.querySelector("#nova-lb-metric")?.addEventListener("change", e => { state.metric = e.target.value; loadBoard(); });
    el.querySelector("#nova-lb-period")?.addEventListener("change", e => { state.period = e.target.value; loadBoard(); });
    el.querySelector(".nova-lb-refresh")?.addEventListener("click", async () => { try { state.loading = true; render(); await api('/api/admin/leaderboards/refresh', { method: 'POST', body: JSON.stringify({ metric_key: state.metric, scope: state.scope, period: state.period }) }); await loadSummary(true); await loadBoard(); } catch(e){ state.error = e.message; state.loading = false; render(); } });
  }
  async function loadSummary(force=false){
    if (state.summary && !force) return state.summary;
    state.summary = await api('/api/leaderboards/summary');
    state.lastVersion = state.summary?.state_versions?.leaderboards ?? state.summary?.snapshot_version ?? null;
    if (!state.summary.metrics?.some(m => m.metric_key === state.metric)) {
      state.metric = state.summary.metrics?.[0]?.metric_key || "player_level";
      state.category = state.summary.metrics?.[0]?.category || "Progression";
    }
    return state.summary;
  }
  async function loadBoard(){
    state.open = true;
    state.loading = true;
    state.error = "";
    render();
    try {
      await loadSummary();
      const url = new URL('/api/leaderboards', window.location.origin);
      url.searchParams.set('metric_key', state.metric);
      url.searchParams.set('scope', state.scope);
      url.searchParams.set('period', state.period);
      if (state.scope === 'faction' && state.summary?.current_faction_id) url.searchParams.set('faction_id', state.summary.current_faction_id);
      state.board = await api(url.pathname + url.search);
    } catch(e){ state.error = e.message || String(e); }
    state.loading = false;
    render();
  }
  async function openPage(){
    state.open = true;
    if (location.hash !== '#leaderboards') history.replaceState(null, '', '#leaderboards');
    render();
    await loadSummary();
    await loadBoard();
  }
  function installNavButton(){
    if (document.querySelector('[data-nova-leaderboards-nav]')) return;
    const host = document.querySelector('.nav, nav, .top-nav, .toolbar, header') || document.body;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.novaLeaderboardsNav = '1';
    btn.className = 'nova-lb-nav-button';
    btn.textContent = 'Leaderboards';
    btn.addEventListener('click', openPage);
    host.appendChild(btn);
  }
  window.addEventListener('hashchange', () => { if (location.hash === '#leaderboards') openPage(); });
  window.addEventListener('nova:state', (ev) => {
    const version = ev?.detail?.state_versions?.leaderboards;
    if (!version || version === state.lastVersion) return;
    state.lastVersion = version;
    if (state.open) loadBoard();
  });
  const originalFetch = window.fetch;
  window.fetch = async function patchedNovaLeaderboardFetch(){
    const res = await originalFetch.apply(this, arguments);
    try {
      const req = arguments[0];
      const url = typeof req === 'string' ? req : req?.url;
      if (url && String(url).includes('/api/state')) {
        res.clone().json().then(data => window.dispatchEvent(new CustomEvent('nova:state', { detail: data }))).catch(()=>{});
      }
    } catch(_) {}
    return res;
  };
  setTimeout(() => { installNavButton(); render(); if (location.hash === '#leaderboards') openPage(); }, 500);
  new MutationObserver(() => installNavButton()).observe(document.documentElement, { childList: true, subtree: true });
})();
// === NOVA LEADERBOARDS PAGE PATCH END ===
'''

CSS_BLOCK = r'''
/* === NOVA LEADERBOARDS PAGE PATCH START === */
.nova-lb-nav-button{border:1px solid rgba(125,211,252,.35);background:rgba(15,23,42,.72);color:#dff7ff;border-radius:999px;padding:.45rem .8rem;font-weight:800;letter-spacing:.02em;cursor:pointer;margin:.25rem}.nova-lb-launcher{position:fixed;right:1.1rem;bottom:5.8rem;z-index:8000;width:3rem;height:3rem;border-radius:999px;border:1px solid rgba(250,204,21,.45);background:linear-gradient(135deg,rgba(30,41,59,.96),rgba(88,28,135,.92));color:#fef3c7;font-size:1.35rem;box-shadow:0 18px 45px rgba(0,0,0,.42);cursor:pointer}.nova-lb-panel{position:fixed;right:1rem;bottom:9.3rem;z-index:8001;width:min(860px,calc(100vw - 2rem));max-height:min(760px,calc(100vh - 7rem));display:none;flex-direction:column;gap:.75rem;padding:1rem;border-radius:1.25rem;border:1px solid rgba(148,163,184,.28);background:rgba(7,12,24,.92);backdrop-filter:blur(16px);box-shadow:0 28px 80px rgba(0,0,0,.58);color:#e5f6ff}.nova-lb-panel.open{display:flex}.nova-lb-head{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem}.nova-lb-head strong{display:block;font-size:1.2rem}.nova-lb-head span{display:block;color:#9fb3c8;font-size:.82rem;margin-top:.15rem}.nova-lb-close{border:0;background:rgba(148,163,184,.14);color:#e2e8f0;border-radius:.75rem;width:2.2rem;height:2.2rem;font-size:1.4rem;cursor:pointer}.nova-lb-tabs{display:flex;gap:.5rem}.nova-lb-tabs button,.nova-lb-refresh{border:1px solid rgba(125,211,252,.22);border-radius:.8rem;background:rgba(15,23,42,.82);color:#dbeafe;padding:.55rem .8rem;font-weight:800;cursor:pointer}.nova-lb-tabs button.active{background:linear-gradient(135deg,rgba(37,99,235,.75),rgba(14,165,233,.65));border-color:rgba(125,211,252,.5)}.nova-lb-filters{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.65rem;align-items:end}.nova-lb-filters label{display:grid;gap:.25rem;color:#9fb3c8;font-size:.78rem;text-transform:uppercase;letter-spacing:.06em}.nova-lb-filters select{width:100%;border:1px solid rgba(148,163,184,.28);background:rgba(2,6,23,.86);color:#e2e8f0;border-radius:.8rem;padding:.55rem}.nova-lb-refresh{background:rgba(22,101,52,.65);border-color:rgba(74,222,128,.32)}.nova-lb-meta{display:flex;flex-wrap:wrap;gap:.5rem;color:#93a4b8;font-size:.82rem}.nova-lb-meta span,.nova-lb-meta b{border:1px solid rgba(148,163,184,.18);background:rgba(15,23,42,.55);border-radius:999px;padding:.25rem .55rem}.nova-lb-meta b{color:#fde68a;border-color:rgba(250,204,21,.35)}.nova-lb-error{padding:.65rem .8rem;border-radius:.9rem;border:1px solid rgba(248,113,113,.35);background:rgba(127,29,29,.35);color:#fecaca}.nova-lb-loading{padding:.65rem .8rem;border-radius:.9rem;background:rgba(15,23,42,.65);color:#bae6fd}.nova-lb-table-wrap{overflow:auto;border:1px solid rgba(148,163,184,.16);border-radius:1rem;background:rgba(2,6,23,.42)}.nova-lb-table{width:100%;border-collapse:collapse;min-width:680px}.nova-lb-table th,.nova-lb-table td{padding:.72rem .8rem;border-bottom:1px solid rgba(148,163,184,.12);text-align:left}.nova-lb-table th{position:sticky;top:0;background:rgba(15,23,42,.96);color:#bfdbfe;font-size:.75rem;text-transform:uppercase;letter-spacing:.06em}.nova-lb-table tr.me{background:rgba(34,197,94,.12)}.nova-lb-empty{text-align:center;color:#94a3b8;padding:1.6rem!important}@media(max-width:760px){.nova-lb-panel{left:.5rem;right:.5rem;bottom:5rem;width:auto;max-height:calc(100vh - 6rem)}.nova-lb-launcher{bottom:1rem}.nova-lb-filters{grid-template-columns:1fr}.nova-lb-table{min-width:620px}}
/* === NOVA LEADERBOARDS PAGE PATCH END === */
'''

NOTES_TEXT = """# Nova Frontiers Leaderboards + State Slimming Notes\n\nThis pass adds snapshot-based player leaderboards and moves the system toward a smaller MMO-safe hot state loop.\n\n## Added\n\n- `leaderboard_metric_definitions`\n- `player_metric_events`\n- `player_metric_daily_rollups`\n- `leaderboard_snapshots`\n- `leaderboard_snapshot_rows`\n- `leaderboard_refresh_jobs`\n- `maintenance_jobs`\n- `nova_state_versions`\n- `leaderboard_settings`\n\n## Main backend hook\n\n```python\nrecord_player_metric(conn, player_id, metric_key, amount, faction_id=None, guild_id=None, planet_id=None, metadata=None)\n```\n\nOnly call it from validated server-side gameplay actions. Do not expose a client endpoint that accepts arbitrary metric values.\n\n## Snapshot model\n\nLeaderboards are generated into snapshot rows. `/api/state` only gets version and flag data. Full rows are fetched by `/api/leaderboards` only when the leaderboard panel/page is open.\n\n## State slimming\n\nThe patch adds:\n\n```json\nstate_versions: { leaderboards, guild_summary, chat_global, chat_faction, messages_unread, market_summary, events_summary, profile, achievements, admin_alerts }\nstate_flags: { has_unread_messages, has_active_battle, has_active_war, has_pending_guild_invite, guild_data_stale, leaderboards_stale, event_page_stale }\n```\n\nBy default it removes only known non-core leaderboard/admin/history payload names if they exist. Set this environment variable for stricter slimming after the frontend is moved to dedicated endpoints:\n\n```bash\nNOVA_STRICT_STATE_SLIMMING=1\n```\n\nStrict mode also defers broader sections such as public profiles, achievements, events, market, guild, and messages. Enable only after testing the relevant pages.\n\n## Cadence\n\n- Leaderboards: daily by default.\n- Weekly/all-time snapshots: regenerated daily.\n- Market/faction summaries: intended hourly.\n- NPC/security/event/stale cleanup: intended 5–15 minutes.\n\nThe included maintenance guard runs at most one lightweight job per minute and skips `/api/state` requests. Long-term, move maintenance into a worker process.\n\n## Manual refresh\n\nAdmins can refresh selected leaderboards through:\n\n```http\nPOST /api/admin/leaderboards/refresh\n```\n\n## Dedicated endpoints\n\n- `GET /api/leaderboards/summary`\n- `GET /api/leaderboards`\n- `GET /api/leaderboards/player`\n- `POST /api/admin/leaderboards/refresh`\n- `POST /api/admin/leaderboards/settings`\n- `GET /api/admin/maintenance/jobs`\n- `POST /api/admin/maintenance/run`\n- `GET /api/admin/state/debug`\n"""

CHECKLIST_TEXT = """# Nova Leaderboards + State Slimming Test Checklist\n\n## Backend\n\n- Start backend without syntax errors.\n- Hit `GET /api/leaderboards/summary`.\n- Confirm metric definitions are seeded.\n- Call `record_player_metric(conn, player_id, 'resources_mined', 10)` from a safe dev console/test route.\n- Confirm `player_metric_events` inserts.\n- Confirm `player_metric_daily_rollups` increments.\n- Hit `POST /api/admin/leaderboards/refresh` as admin.\n- Confirm snapshot row creation.\n- Confirm `GET /api/leaderboards?metric_key=resources_mined&scope=global&period=daily` returns rows.\n- Confirm faction scope works with `scope=faction`.\n- Confirm non-admin cannot call admin refresh.\n- Confirm failed leaderboard writes do not break gameplay actions.\n\n## Frontend\n\n- Open Leaderboards.\n- Switch Global/Faction.\n- Switch category.\n- Switch metric.\n- Switch period.\n- Confirm current player row highlights if present.\n- Confirm admin manual refresh button appears only for admins.\n- Confirm leaderboards do not poll every state tick.\n\n## State Payload\n\n- Confirm `/api/state` includes `state_versions`.\n- Confirm `/api/state` includes `state_flags`.\n- Confirm `/api/state` does not include full leaderboard rows.\n- Use `/api/admin/state/debug` to identify largest remaining sections.\n- Enable `NOVA_STRICT_STATE_SLIMMING=1` only after dedicated page endpoints are verified.\n\n## 100-user MMO check\n\n- Simulate many `/api/state` polls.\n- Confirm no leaderboard snapshot generation occurs from state calls.\n- Confirm maintenance does not run more than one guarded job per minute.\n- Confirm opening leaderboard page does not rebuild all metrics.\n"""

CHANGELOG_TEXT = """Nova Frontiers Leaderboards + State Slimming Patch\n\nChanged files:\n- backend/app/main.py\n- frontend/src/main.jsx\n- frontend/src/styles.css\n- NOVA_LEADERBOARDS_STATE_SLIMMING_NOTES.md\n- NOVA_LEADERBOARDS_STATE_SLIMMING_TEST_CHECKLIST.md\n\nBackend:\n- Added leaderboard schema and seed metrics.\n- Added `record_player_metric` / `nova_record_player_metric`.\n- Added daily rollup writes.\n- Added snapshot generation for global and faction leaderboards.\n- Added guarded maintenance jobs.\n- Added admin manual refresh/settings endpoints.\n- Added state_versions/state_flags helper.\n- Patched build_state to append versions/flags and defer configured heavy sections.\n- Added admin state debug endpoint.\n\nFrontend:\n- Added Leaderboards page/panel with Global and Faction tabs.\n- Added category, metric, and period filters.\n- Added admin manual refresh button.\n- Added client-side state version listener so open leaderboards refetch only when needed.\n\nCSS:\n- Added MMO-style leaderboard panel/table styling.\n\nNotes:\n- Gameplay loops still need explicit calls to `record_player_metric` at each validated server-side action.\n- The patch does not fake missing metrics. Empty boards are valid until hooks record real data.\n"""

def insert_backend_block():
    if not BACKEND.exists():
        raise FileNotFoundError(f"Missing {BACKEND}")
    backup(BACKEND)
    text = BACKEND.read_text(encoding="utf-8", errors="ignore")
    text = replace_block(text, BACKEND_MARKER, BACKEND_END, BACKEND_BLOCK.strip())
    text = patch_build_state(text)
    BACKEND.write_text(text, encoding="utf-8")

def find_function_span(text: str, name: str):
    m = re.search(rf"^def\s+{re.escape(name)}\s*\([^)]*\):\s*$", text, re.M)
    if not m:
        return None
    start = m.start()
    next_m = re.search(r"^def\s+\w+\s*\(|^@\w", text[m.end():], re.M)
    end = m.end() + next_m.start() if next_m else len(text)
    return start, end

def patch_build_state(text: str) -> str:
    if STATE_MARKER in text:
        return text
    span = find_function_span(text, "build_state")
    if not span:
        return text
    start, end = span
    fn = text[start:end]
    matches = list(re.finditer(r"^(\s*)return\s+(state|payload|result)\s*$", fn, re.M))
    if not matches:
        return text
    m = matches[-1]
    indent = m.group(1)
    var = m.group(2)
    injection = f'''{indent}try:\n{indent}    # {STATE_MARKER}: add small client versions/flags and defer configured heavy sections.\n{indent}    {var} = nova_slim_state_payload({var})\n{indent}except Exception as _nova_state_flags_exc:\n{indent}    try:\n{indent}        print("[leaderboards] state flags/slimming skipped", _nova_state_flags_exc)\n{indent}    except Exception:\n{indent}        pass\n{indent}return {var}'''
    fn2 = fn[:m.start()] + injection + fn[m.end():]
    return text[:start] + fn2 + text[end:]

def patch_frontend():
    if not FRONTEND.exists():
        raise FileNotFoundError(f"Missing {FRONTEND}")
    backup(FRONTEND)
    text = FRONTEND.read_text(encoding="utf-8", errors="ignore")
    text = replace_block(text, FRONTEND_MARKER, FRONTEND_END, FRONTEND_BLOCK.strip())
    FRONTEND.write_text(text, encoding="utf-8")

def patch_css():
    if not CSS.exists():
        raise FileNotFoundError(f"Missing {CSS}")
    backup(CSS)
    text = CSS.read_text(encoding="utf-8", errors="ignore")
    text = replace_block(text, CSS_MARKER, CSS_END, CSS_BLOCK.strip())
    CSS.write_text(text, encoding="utf-8")

def write_docs():
    NOTES.write_text(NOTES_TEXT, encoding="utf-8")
    CHECKLIST.write_text(CHECKLIST_TEXT, encoding="utf-8")
    CHANGELOG.write_text(CHANGELOG_TEXT, encoding="utf-8")

def main():
    insert_backend_block()
    patch_frontend()
    patch_css()
    write_docs()
    print("Applied Nova leaderboards + state slimming patch.")
    print("Run: python -m py_compile backend/app/main.py")
    print("Run: cd frontend && npm run build")

if __name__ == "__main__":
    main()
