from __future__ import annotations

import shutil
import sys
from datetime import datetime
from pathlib import Path

STAMP = datetime.now().strftime('%Y%m%d-%H%M%S')
ROOT = Path.cwd()
BACKEND = ROOT / 'backend' / 'app' / 'main.py'
FRONTEND = ROOT / 'frontend' / 'src' / 'main.jsx'
CSS = ROOT / 'frontend' / 'src' / 'styles.css'
DOC = ROOT / 'NOVA_GUILD_SYSTEM_NOTES.md'
TESTS = ROOT / 'NOVA_GUILD_SYSTEM_TEST_CHECKLIST.md'

BACKEND_MARKER = 'NOVA_GUILD_SYSTEM_REWRITE_V1'
FRONTEND_MARKER = 'NOVA_GUILD_SYSTEM_FRONTEND_V1'
CSS_MARKER = 'NOVA_GUILD_SYSTEM_CSS_V1'
DOC_MARKER = 'NOVA_GUILD_SYSTEM_NOTES_V1'
TEST_MARKER = 'NOVA_GUILD_SYSTEM_TEST_CHECKLIST_V1'

changed: list[str] = []
skipped: list[str] = []


def fail(msg: str) -> None:
    print(f'ERROR: {msg}', file=sys.stderr)
    sys.exit(1)


def read_text(path: Path) -> str:
    if not path.exists():
        fail(f'Missing required file: {path}')
    return path.read_text(encoding='utf-8')


def backup(path: Path) -> None:
    if not path.exists():
        return
    backup_path = path.with_suffix(path.suffix + f'.bak-{STAMP}')
    if not backup_path.exists():
        shutil.copy2(path, backup_path)


def write_if_changed(path: Path, old: str | None, new: str, label: str) -> None:
    if old == new:
        skipped.append(f'{label}: already current')
        return
    backup(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(new, encoding='utf-8', newline='')
    changed.append(label)


def patch_backend() -> None:
    text = read_text(BACKEND)
    original = text
    if BACKEND_MARKER in text:
        skipped.append('backend/app/main.py: guild backend marker already present')
        return

    block = r"""

# NOVA_GUILD_SYSTEM_REWRITE_V1
# Guild system rewrite foundation.
# This block is intentionally isolated from /api/state. Guild state is loaded only from dedicated /api/guild/* endpoints.
# Core loop: activity/contribution -> guild XP -> level/research -> armory/treasury -> war/planet influence.
import json as _nova_guild_json
import sqlite3 as _nova_guild_sqlite3
import time as _nova_guild_time
from pathlib import Path as _NovaGuildPath
from datetime import datetime as _NovaGuildDatetime, timezone as _NovaGuildTimezone
try:
    from fastapi import HTTPException as _NovaGuildHTTPException
except Exception:  # pragma: no cover
    _NovaGuildHTTPException = Exception
try:
    from pydantic import BaseModel as _NovaGuildBaseModel
except Exception:  # pragma: no cover
    _NovaGuildBaseModel = object


class NovaGuildCreateRequest(_NovaGuildBaseModel):
    player_id: int
    name: str
    tag: str
    description: str = ''
    status: str = 'public'


class NovaGuildApplyRequest(_NovaGuildBaseModel):
    player_id: int
    guild_id: int
    message: str = ''


class NovaGuildInviteRequest(_NovaGuildBaseModel):
    player_id: int
    guild_id: int
    recipient_id: int = None
    recipient_name: str = None
    message: str = ''


class NovaGuildInviteRespondRequest(_NovaGuildBaseModel):
    player_id: int
    invite_id: int
    accept: bool


class NovaGuildLeaveRequest(_NovaGuildBaseModel):
    player_id: int
    guild_id: int


class NovaGuildKickRequest(_NovaGuildBaseModel):
    player_id: int
    guild_id: int
    target_player_id: int


class NovaGuildRankUpdateRequest(_NovaGuildBaseModel):
    player_id: int
    guild_id: int
    target_player_id: int
    rank_id: int


class NovaGuildContributionRequest(_NovaGuildBaseModel):
    player_id: int
    contribution_type: str = 'activity'
    xp: int = 0
    quantity: int = 1
    source: str = 'manual'
    metadata: dict = {}


class NovaGuildResearchUnlockRequest(_NovaGuildBaseModel):
    player_id: int
    guild_id: int
    research_key: str


class NovaGuildArmoryMoveRequest(_NovaGuildBaseModel):
    player_id: int
    guild_id: int
    planet_id: int = None
    item_type: str = 'material'
    item_key: str
    item_name: str = ''
    quantity: int = 1
    tier: str = ''
    quality: str = ''


class NovaGuildTreasuryDepositRequest(_NovaGuildBaseModel):
    player_id: int
    guild_id: int
    amount: int


class NovaGuildWarDeclareRequest(_NovaGuildBaseModel):
    player_id: int
    guild_id: int
    target_type: str = 'guild'
    target_guild_id: int = None
    target_planet_id: int = None
    reason: str = ''


class NovaGuildWarSurrenderRequest(_NovaGuildBaseModel):
    player_id: int
    guild_id: int
    war_id: int


class NovaGuildSettingsRequest(_NovaGuildBaseModel):
    player_id: int = None
    settings: dict = {}


def _nova_guild_now_iso() -> str:
    return _NovaGuildDatetime.now(_NovaGuildTimezone.utc).isoformat()


def _nova_guild_json_dumps(value) -> str:
    return _nova_guild_json.dumps(value if value is not None else {}, ensure_ascii=False, separators=(',', ':'))


def _nova_guild_req_dict(req) -> dict:
    if hasattr(req, 'model_dump'):
        try:
            return req.model_dump()
        except Exception:
            pass
    if hasattr(req, 'dict'):
        try:
            return req.dict()
        except Exception:
            pass
    return getattr(req, '__dict__', {}) or {}


def _nova_guild_raise(status_code: int, detail: str):
    try:
        raise _NovaGuildHTTPException(status_code=status_code, detail=detail)
    except TypeError:
        raise _NovaGuildHTTPException(detail)


def _nova_guild_candidate_db_paths() -> list:
    found = []
    for name in ('DB_PATH', 'DATABASE_PATH', 'DATABASE', 'SQLITE_PATH'):
        value = globals().get(name)
        if value:
            try:
                p = _NovaGuildPath(str(value))
                if p.exists() or p.suffix == '.db':
                    found.append(p)
            except Exception:
                pass
    roots = []
    try:
        roots.append(_NovaGuildPath(__file__).resolve().parent)
        roots.extend(_NovaGuildPath(__file__).resolve().parents)
    except Exception:
        roots.append(_NovaGuildPath.cwd())
    names = ('nova_frontiers.db', 'nova.db', 'game.db', 'database.db', 'app.db', 'db.sqlite3')
    for root in roots:
        for candidate in names:
            p = root / candidate
            if p.exists():
                found.append(p)
        try:
            for p in root.glob('*.db'):
                found.append(p)
        except Exception:
            pass
    out = []
    seen = set()
    for p in found:
        try:
            key = str(p.resolve())
        except Exception:
            key = str(p)
        if key not in seen:
            seen.add(key)
            out.append(p)
    return out


def _nova_guild_open_conn():
    for fn_name in ('get_conn', 'get_connection', 'connect_db', 'db_connect', 'open_db'):
        fn = globals().get(fn_name)
        if callable(fn):
            try:
                conn = fn()
                if hasattr(conn, 'execute'):
                    try:
                        conn.row_factory = _nova_guild_sqlite3.Row
                    except Exception:
                        pass
                    return conn
            except TypeError:
                pass
            except Exception:
                pass
    for p in _nova_guild_candidate_db_paths():
        try:
            conn = _nova_guild_sqlite3.connect(str(p), timeout=30, check_same_thread=False)
            conn.row_factory = _nova_guild_sqlite3.Row
            try:
                conn.execute('PRAGMA foreign_keys=ON')
                conn.execute('PRAGMA journal_mode=WAL')
                conn.execute('PRAGMA busy_timeout=30000')
            except Exception:
                pass
            return conn
        except Exception:
            continue
    _nova_guild_raise(500, 'Guild database connection could not be resolved')


def _nova_guild_rows(conn, sql: str, params: tuple = ()) -> list:
    cur = conn.execute(sql, params)
    out = []
    for r in cur.fetchall():
        try:
            out.append(dict(r))
        except Exception:
            cols = [d[0] for d in cur.description or []]
            out.append({cols[i]: r[i] for i in range(min(len(cols), len(r)))})
    return out


def _nova_guild_row(conn, sql: str, params: tuple = ()):
    rows = _nova_guild_rows(conn, sql, params)
    return rows[0] if rows else None


def _nova_guild_table_exists(conn, table: str) -> bool:
    try:
        return bool(_nova_guild_row(conn, 'SELECT 1 FROM sqlite_master WHERE type="table" AND name=? LIMIT 1', (table,)))
    except Exception:
        return False


def _nova_guild_cols(conn, table: str) -> set:
    try:
        return {str(r.get('name')) for r in _nova_guild_rows(conn, f'PRAGMA table_info({table})')}
    except Exception:
        return set()


def _nova_guild_first_col(cols: set, choices: tuple):
    for c in choices:
        if c in cols:
            return c
    return None


def _nova_guild_int(v, default=0) -> int:
    try:
        if v is None or v == '':
            return int(default)
        return int(float(v))
    except Exception:
        return int(default)


def _nova_guild_float(v, default=0.0) -> float:
    try:
        if v is None or v == '':
            return float(default)
        return float(v)
    except Exception:
        return float(default)


def _nova_guild_clamp_text(v, max_len: int) -> str:
    return str(v or '').strip()[:max_len]


def _nova_guild_setting(conn, key: str, default: str = '') -> str:
    nova_guild_ensure_tables(conn)
    row = _nova_guild_row(conn, 'SELECT value FROM guild_settings WHERE key=?', (key,))
    return str((row or {}).get('value') or default)


def _nova_guild_settings(conn) -> dict:
    nova_guild_ensure_tables(conn)
    return {r['key']: r['value'] for r in _nova_guild_rows(conn, 'SELECT key, value FROM guild_settings')}


def _nova_guild_xp_required(level: int) -> int:
    # Capped first pass; easy to swap to settings table later.
    return {1: 0, 2: 2500, 3: 8000, 4: 18000, 5: 36000}.get(int(level), 36000 + (int(level) - 5) * 25000)


def _nova_guild_member_cap(level: int) -> int:
    return max(10, min(50, int(level) * 10))


def nova_guild_ensure_tables(conn) -> None:
    conn.execute('''CREATE TABLE IF NOT EXISTS guild_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )''')
    defaults = {
        'guild_creation_cost': '25000',
        'guild_max_level': '5',
        'daily_contribution_soft_cap': '2500',
        'daily_contribution_overcap_multiplier': '0.20',
        'new_member_armory_lock_seconds': '86400',
        'guild_tax_max_percent': '10',
        'guild_war_prep_seconds': '1800',
        'guild_war_duration_seconds': '86400',
        'guild_war_cooldown_seconds': '172800',
        'guild_war_base_cost': '50000',
        'planet_war_base_cost': '150000',
        'planet_war_duration_seconds': '172800',
        'planet_war_min_security': '0.0'
    }
    now = _nova_guild_now_iso()
    for k, v in defaults.items():
        conn.execute('INSERT OR IGNORE INTO guild_settings(key,value,updated_at) VALUES(?,?,?)', (k, v, now))

    conn.execute('''CREATE TABLE IF NOT EXISTS guilds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        tag TEXT NOT NULL UNIQUE,
        description TEXT DEFAULT '',
        faction_id TEXT,
        founder_player_id INTEGER NOT NULL,
        leader_player_id INTEGER NOT NULL,
        home_planet_id INTEGER,
        level INTEGER NOT NULL DEFAULT 1,
        xp INTEGER NOT NULL DEFAULT 0,
        research_points INTEGER NOT NULL DEFAULT 0,
        treasury INTEGER NOT NULL DEFAULT 0,
        max_members INTEGER NOT NULL DEFAULT 10,
        status TEXT NOT NULL DEFAULT 'public',
        emblem TEXT DEFAULT '',
        motd TEXT DEFAULT '',
        tax_percent REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
    )''')
    conn.execute('''CREATE TABLE IF NOT EXISTS guild_ranks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        can_invite INTEGER NOT NULL DEFAULT 0,
        can_accept_applications INTEGER NOT NULL DEFAULT 0,
        can_kick INTEGER NOT NULL DEFAULT 0,
        can_promote INTEGER NOT NULL DEFAULT 0,
        can_demote INTEGER NOT NULL DEFAULT 0,
        can_manage_ranks INTEGER NOT NULL DEFAULT 0,
        can_declare_war INTEGER NOT NULL DEFAULT 0,
        can_manage_war INTEGER NOT NULL DEFAULT 0,
        can_manage_treasury INTEGER NOT NULL DEFAULT 0,
        can_start_research INTEGER NOT NULL DEFAULT 0,
        can_cancel_research INTEGER NOT NULL DEFAULT 0,
        can_manage_armory INTEGER NOT NULL DEFAULT 0,
        can_withdraw_armory INTEGER NOT NULL DEFAULT 0,
        can_deposit_armory INTEGER NOT NULL DEFAULT 1,
        can_edit_motd INTEGER NOT NULL DEFAULT 0,
        can_disband INTEGER NOT NULL DEFAULT 0,
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        UNIQUE(guild_id, name)
    )''')
    conn.execute('''CREATE TABLE IF NOT EXISTS guild_members (
        guild_id INTEGER NOT NULL,
        player_id INTEGER NOT NULL,
        rank_id INTEGER NOT NULL,
        joined_at TEXT NOT NULL,
        contribution_total INTEGER NOT NULL DEFAULT 0,
        last_left_at TEXT,
        PRIMARY KEY(guild_id, player_id)
    )''')
    conn.execute('''CREATE TABLE IF NOT EXISTS guild_applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id INTEGER NOT NULL,
        player_id INTEGER NOT NULL,
        message TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        resolved_at TEXT,
        UNIQUE(guild_id, player_id, status)
    )''')
    conn.execute('''CREATE TABLE IF NOT EXISTS guild_invites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id INTEGER NOT NULL,
        sender_player_id INTEGER NOT NULL,
        recipient_player_id INTEGER NOT NULL,
        message TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        resolved_at TEXT
    )''')
    conn.execute('''CREATE TABLE IF NOT EXISTS guild_contributions_daily (
        guild_id INTEGER NOT NULL,
        player_id INTEGER NOT NULL,
        day TEXT NOT NULL,
        material_xp INTEGER NOT NULL DEFAULT 0,
        money_xp INTEGER NOT NULL DEFAULT 0,
        combat_xp INTEGER NOT NULL DEFAULT 0,
        crafting_xp INTEGER NOT NULL DEFAULT 0,
        mission_xp INTEGER NOT NULL DEFAULT 0,
        war_xp INTEGER NOT NULL DEFAULT 0,
        other_xp INTEGER NOT NULL DEFAULT 0,
        raw_xp INTEGER NOT NULL DEFAULT 0,
        effective_xp INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(guild_id, player_id, day)
    )''')
    conn.execute('''CREATE TABLE IF NOT EXISTS guild_contribution_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id INTEGER NOT NULL,
        player_id INTEGER NOT NULL,
        contribution_type TEXT NOT NULL,
        raw_xp INTEGER NOT NULL,
        effective_xp INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        source TEXT NOT NULL DEFAULT 'activity',
        metadata_json TEXT DEFAULT '{}',
        created_at TEXT NOT NULL
    )''')
    conn.execute('''CREATE TABLE IF NOT EXISTS guild_research_definitions (
        research_key TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        max_rank INTEGER NOT NULL DEFAULT 5,
        points_per_rank INTEGER NOT NULL DEFAULT 1,
        required_guild_level INTEGER NOT NULL DEFAULT 1,
        bonus_type TEXT NOT NULL,
        bonus_per_rank REAL NOT NULL DEFAULT 1.0,
        bonus_cap REAL NOT NULL DEFAULT 5.0,
        sort_order INTEGER NOT NULL DEFAULT 0
    )''')
    conn.execute('''CREATE TABLE IF NOT EXISTS guild_research (
        guild_id INTEGER NOT NULL,
        research_key TEXT NOT NULL,
        rank INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(guild_id, research_key)
    )''')
    conn.execute('''CREATE TABLE IF NOT EXISTS guild_armory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id INTEGER NOT NULL,
        planet_id INTEGER NOT NULL,
        item_type TEXT NOT NULL,
        item_key TEXT NOT NULL,
        item_name TEXT DEFAULT '',
        quantity INTEGER NOT NULL DEFAULT 0,
        tier TEXT DEFAULT '',
        quality TEXT DEFAULT '',
        locked INTEGER NOT NULL DEFAULT 0,
        deposited_by INTEGER,
        last_withdrawn_by INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(guild_id, planet_id, item_type, item_key, tier, quality)
    )''')
    conn.execute('''CREATE TABLE IF NOT EXISTS guild_treasury_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id INTEGER NOT NULL,
        player_id INTEGER,
        amount INTEGER NOT NULL,
        balance_after INTEGER NOT NULL,
        reason TEXT NOT NULL,
        metadata_json TEXT DEFAULT '{}',
        created_at TEXT NOT NULL
    )''')
    conn.execute('''CREATE TABLE IF NOT EXISTS guild_wars (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        attacker_guild_id INTEGER NOT NULL,
        defender_guild_id INTEGER,
        target_planet_id INTEGER,
        target_type TEXT NOT NULL,
        status TEXT NOT NULL,
        declaration_cost INTEGER NOT NULL,
        reason TEXT DEFAULT '',
        declared_by INTEGER NOT NULL,
        declared_at TEXT NOT NULL,
        prep_ends_at TEXT,
        starts_at TEXT,
        ends_at TEXT,
        resolved_at TEXT,
        winner_guild_id INTEGER,
        metadata_json TEXT DEFAULT '{}'
    )''')
    conn.execute('''CREATE TABLE IF NOT EXISTS guild_war_scores (
        war_id INTEGER NOT NULL,
        guild_id INTEGER NOT NULL,
        pvp_kills INTEGER NOT NULL DEFAULT 0,
        npc_kills INTEGER NOT NULL DEFAULT 0,
        objectives INTEGER NOT NULL DEFAULT 0,
        cargo_score INTEGER NOT NULL DEFAULT 0,
        influence_score INTEGER NOT NULL DEFAULT 0,
        total_score INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(war_id, guild_id)
    )''')
    conn.execute('''CREATE TABLE IF NOT EXISTS guild_planet_influence (
        planet_id INTEGER NOT NULL,
        guild_id INTEGER NOT NULL,
        influence INTEGER NOT NULL DEFAULT 0,
        war_id INTEGER,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(planet_id, guild_id)
    )''')
    conn.execute('''CREATE TABLE IF NOT EXISTS guild_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id INTEGER NOT NULL,
        actor_player_id INTEGER,
        action TEXT NOT NULL,
        target_player_id INTEGER,
        metadata_json TEXT DEFAULT '{}',
        created_at TEXT NOT NULL
    )''')
    indexes = [
        'CREATE INDEX IF NOT EXISTS idx_guild_members_player ON guild_members(player_id)',
        'CREATE INDEX IF NOT EXISTS idx_guild_members_guild ON guild_members(guild_id)',
        'CREATE INDEX IF NOT EXISTS idx_guild_apps_guild_status ON guild_applications(guild_id,status)',
        'CREATE INDEX IF NOT EXISTS idx_guild_invites_recipient_status ON guild_invites(recipient_player_id,status)',
        'CREATE INDEX IF NOT EXISTS idx_guild_contrib_daily_guild_day ON guild_contributions_daily(guild_id,day)',
        'CREATE INDEX IF NOT EXISTS idx_guild_contrib_events_guild_created ON guild_contribution_events(guild_id,created_at)',
        'CREATE INDEX IF NOT EXISTS idx_guild_armory_guild_planet ON guild_armory(guild_id,planet_id)',
        'CREATE INDEX IF NOT EXISTS idx_guild_wars_attacker_status ON guild_wars(attacker_guild_id,status)',
        'CREATE INDEX IF NOT EXISTS idx_guild_wars_defender_status ON guild_wars(defender_guild_id,status)',
        'CREATE INDEX IF NOT EXISTS idx_guild_wars_planet_status ON guild_wars(target_planet_id,status)',
        'CREATE INDEX IF NOT EXISTS idx_guild_logs_guild_created ON guild_logs(guild_id,created_at)',
    ]
    for sql in indexes:
        conn.execute(sql)
    nova_guild_seed_research(conn)
    conn.commit()


def nova_guild_seed_research(conn) -> None:
    rows = [
        ('industry_crafting_speed','Industry','Efficient Fabrication','+1% crafting speed per rank.',5,1,1,'crafting_speed_pct',1,5,10),
        ('industry_material_efficiency','Industry','Material Discipline','+1% material efficiency per rank.',5,1,2,'material_efficiency_pct',1,5,20),
        ('mining_yield','Mining','Coordinated Mining','+1% mining yield per rank.',5,1,1,'mining_yield_pct',1,5,30),
        ('mining_rare_chance','Mining','Deep Survey Methods','+1% rare material chance per rank.',5,1,2,'rare_material_chance_pct',1,5,40),
        ('processing_output','Refining','Cleaner Refining','+1% processing output per rank.',5,1,1,'processing_output_pct',1,5,50),
        ('combat_npc_damage','Combat','Fleet Fire Control','+1% damage against NPCs per rank.',5,1,1,'npc_damage_pct',1,5,60),
        ('combat_shield_recovery','Combat','Shield Discipline','+1% shield recovery per rank.',5,1,2,'shield_recovery_pct',1,5,70),
        ('defense_turret_durability','Defense','Hardened Emplacements','+1% turret durability on controlled planets per rank.',5,1,3,'turret_durability_pct',1,5,80),
        ('logistics_fuel_efficiency','Logistics','Route Optimization','+1% travel fuel efficiency per rank.',5,1,1,'fuel_efficiency_pct',1,5,90),
        ('economy_mission_payout','Economy','Contract Office','+1% mission payout bonus per rank.',5,1,1,'mission_payout_pct',1,5,100),
        ('exploration_scan_range','Exploration','Signal Cartography','+1% scan range per rank.',5,1,1,'scan_range_pct',1,5,110),
        ('war_declaration_discount','War','Casus Belli Logistics','-1% war declaration cost per rank.',5,1,3,'war_cost_reduction_pct',1,5,120),
        ('war_capture_progress','War','Occupation Doctrine','+1% planet capture progress per rank.',5,1,4,'capture_progress_pct',1,5,130),
    ]
    for r in rows:
        conn.execute('''INSERT OR IGNORE INTO guild_research_definitions
            (research_key,category,name,description,max_rank,points_per_rank,required_guild_level,bonus_type,bonus_per_rank,bonus_cap,sort_order)
            VALUES(?,?,?,?,?,?,?,?,?,?,?)''', r)


def _nova_guild_player(conn, player_id: int):
    if not _nova_guild_table_exists(conn, 'players'):
        return {'id': player_id, 'username': f'Player {player_id}', 'gold': 0, 'planet_id': None, 'faction_id': None}
    cols = _nova_guild_cols(conn, 'players')
    id_col = _nova_guild_first_col(cols, ('id','player_id')) or 'id'
    name_col = _nova_guild_first_col(cols, ('username','name','display_name','captain_name','pilot_name'))
    gold_col = _nova_guild_first_col(cols, ('gold','credits','money','balance'))
    planet_col = _nova_guild_first_col(cols, ('planet_id','current_planet_id','docked_planet_id','location_planet_id'))
    faction_col = _nova_guild_first_col(cols, ('faction_id','faction','faction_key'))
    fields = [f'{id_col} AS id']
    if name_col: fields.append(f'{name_col} AS username')
    if gold_col: fields.append(f'{gold_col} AS gold')
    if planet_col: fields.append(f'{planet_col} AS planet_id')
    if faction_col: fields.append(f'{faction_col} AS faction_id')
    row = _nova_guild_row(conn, f'SELECT {", ".join(fields)} FROM players WHERE {id_col}=? LIMIT 1', (player_id,))
    if not row:
        return None
    row.setdefault('username', f'Player {player_id}')
    row.setdefault('gold', 0)
    row.setdefault('planet_id', None)
    row.setdefault('faction_id', None)
    return row


def _nova_guild_player_by_name(conn, name: str):
    if not _nova_guild_table_exists(conn, 'players'):
        return None
    cols = _nova_guild_cols(conn, 'players')
    id_col = _nova_guild_first_col(cols, ('id','player_id')) or 'id'
    name_col = _nova_guild_first_col(cols, ('username','name','display_name','captain_name','pilot_name'))
    if not name_col:
        return None
    return _nova_guild_row(conn, f'SELECT {id_col} AS id, {name_col} AS username FROM players WHERE lower({name_col})=lower(?) LIMIT 1', (name,))


def _nova_guild_update_player_money(conn, player_id: int, delta: int) -> None:
    if not _nova_guild_table_exists(conn, 'players'):
        if delta < 0:
            _nova_guild_raise(500, 'Player money adapter unavailable')
        return
    cols = _nova_guild_cols(conn, 'players')
    id_col = _nova_guild_first_col(cols, ('id','player_id')) or 'id'
    gold_col = _nova_guild_first_col(cols, ('gold','credits','money','balance'))
    if not gold_col:
        if delta < 0:
            _nova_guild_raise(500, 'Player money column not found')
        return
    row = _nova_guild_row(conn, f'SELECT {gold_col} AS gold FROM players WHERE {id_col}=? LIMIT 1', (player_id,))
    if not row:
        _nova_guild_raise(404, 'Player not found')
    current = _nova_guild_int(row.get('gold'), 0)
    if current + int(delta) < 0:
        _nova_guild_raise(400, 'Not enough money')
    conn.execute(f'UPDATE players SET {gold_col}=? WHERE {id_col}=?', (current + int(delta), player_id))


def _nova_guild_membership(conn, player_id: int):
    return _nova_guild_row(conn, '''SELECT gm.*, g.name AS guild_name, g.tag AS guild_tag, gr.name AS rank_name,
                                           gr.sort_order AS rank_order,
                                           gr.can_invite, gr.can_accept_applications, gr.can_kick, gr.can_promote,
                                           gr.can_demote, gr.can_manage_ranks, gr.can_declare_war, gr.can_manage_war,
                                           gr.can_manage_treasury, gr.can_start_research, gr.can_cancel_research,
                                           gr.can_manage_armory, gr.can_withdraw_armory, gr.can_deposit_armory,
                                           gr.can_edit_motd, gr.can_disband
                                    FROM guild_members gm
                                    JOIN guilds g ON g.id=gm.guild_id AND g.deleted_at IS NULL
                                    JOIN guild_ranks gr ON gr.id=gm.rank_id
                                    WHERE gm.player_id=? LIMIT 1''', (player_id,))


def _nova_guild_require_membership(conn, player_id: int, guild_id: int):
    row = _nova_guild_row(conn, '''SELECT gm.*, gr.name AS rank_name, gr.sort_order AS rank_order,
                                          gr.can_invite, gr.can_accept_applications, gr.can_kick, gr.can_promote,
                                          gr.can_demote, gr.can_manage_ranks, gr.can_declare_war, gr.can_manage_war,
                                          gr.can_manage_treasury, gr.can_start_research, gr.can_cancel_research,
                                          gr.can_manage_armory, gr.can_withdraw_armory, gr.can_deposit_armory,
                                          gr.can_edit_motd, gr.can_disband
                                   FROM guild_members gm JOIN guild_ranks gr ON gr.id=gm.rank_id
                                   WHERE gm.player_id=? AND gm.guild_id=? LIMIT 1''', (player_id, guild_id))
    if not row:
        _nova_guild_raise(403, 'Guild membership required')
    return row


def _nova_guild_has_perm(member: dict, permission: str) -> bool:
    return bool(_nova_guild_int(member.get(permission), 0))


def _nova_guild_rank_by_name(conn, guild_id: int, name: str):
    return _nova_guild_row(conn, 'SELECT * FROM guild_ranks WHERE guild_id=? AND name=? LIMIT 1', (guild_id, name))


def _nova_guild_default_rank(conn, guild_id: int):
    return _nova_guild_row(conn, 'SELECT * FROM guild_ranks WHERE guild_id=? AND is_default=1 LIMIT 1', (guild_id,)) or _nova_guild_rank_by_name(conn, guild_id, 'Recruit')


def _nova_guild_create_default_ranks(conn, guild_id: int) -> None:
    now = _nova_guild_now_iso()
    rank_defs = [
        ('Leader', 100, dict(can_invite=1,can_accept_applications=1,can_kick=1,can_promote=1,can_demote=1,can_manage_ranks=1,can_declare_war=1,can_manage_war=1,can_manage_treasury=1,can_start_research=1,can_cancel_research=1,can_manage_armory=1,can_withdraw_armory=1,can_deposit_armory=1,can_edit_motd=1,can_disband=1,is_default=0)),
        ('Officer', 80, dict(can_invite=1,can_accept_applications=1,can_kick=1,can_promote=0,can_demote=0,can_manage_ranks=0,can_declare_war=1,can_manage_war=1,can_manage_treasury=1,can_start_research=1,can_cancel_research=0,can_manage_armory=1,can_withdraw_armory=1,can_deposit_armory=1,can_edit_motd=1,can_disband=0,is_default=0)),
        ('Veteran', 60, dict(can_invite=1,can_accept_applications=0,can_kick=0,can_promote=0,can_demote=0,can_manage_ranks=0,can_declare_war=0,can_manage_war=0,can_manage_treasury=0,can_start_research=0,can_cancel_research=0,can_manage_armory=0,can_withdraw_armory=1,can_deposit_armory=1,can_edit_motd=0,can_disband=0,is_default=0)),
        ('Member', 40, dict(can_invite=0,can_accept_applications=0,can_kick=0,can_promote=0,can_demote=0,can_manage_ranks=0,can_declare_war=0,can_manage_war=0,can_manage_treasury=0,can_start_research=0,can_cancel_research=0,can_manage_armory=0,can_withdraw_armory=0,can_deposit_armory=1,can_edit_motd=0,can_disband=0,is_default=0)),
        ('Recruit', 20, dict(can_invite=0,can_accept_applications=0,can_kick=0,can_promote=0,can_demote=0,can_manage_ranks=0,can_declare_war=0,can_manage_war=0,can_manage_treasury=0,can_start_research=0,can_cancel_research=0,can_manage_armory=0,can_withdraw_armory=0,can_deposit_armory=1,can_edit_motd=0,can_disband=0,is_default=1)),
    ]
    cols = ['guild_id','name','sort_order','can_invite','can_accept_applications','can_kick','can_promote','can_demote','can_manage_ranks','can_declare_war','can_manage_war','can_manage_treasury','can_start_research','can_cancel_research','can_manage_armory','can_withdraw_armory','can_deposit_armory','can_edit_motd','can_disband','is_default','created_at']
    for name, sort_order, perms in rank_defs:
        vals = [guild_id, name, sort_order] + [int(perms.get(c, 0)) for c in cols[3:-1]] + [now]
        conn.execute(f'INSERT OR IGNORE INTO guild_ranks({",".join(cols)}) VALUES({",".join(["?"]*len(cols))})', tuple(vals))


def _nova_guild_log(conn, guild_id: int, actor_player_id, action: str, target_player_id=None, metadata=None) -> None:
    conn.execute('''INSERT INTO guild_logs(guild_id,actor_player_id,action,target_player_id,metadata_json,created_at)
                   VALUES(?,?,?,?,?,?)''', (guild_id, actor_player_id, action, target_player_id, _nova_guild_json_dumps(metadata or {}), _nova_guild_now_iso()))


def _nova_guild_level_apply(conn, guild_id: int) -> None:
    g = _nova_guild_row(conn, 'SELECT * FROM guilds WHERE id=?', (guild_id,))
    if not g:
        return
    max_level = _nova_guild_int(_nova_guild_setting(conn, 'guild_max_level', '5'), 5)
    level = _nova_guild_int(g.get('level'), 1)
    xp = _nova_guild_int(g.get('xp'), 0)
    points_add = 0
    while level < max_level and xp >= _nova_guild_xp_required(level + 1):
        level += 1
        points_add += level
    if level != _nova_guild_int(g.get('level'), 1):
        conn.execute('UPDATE guilds SET level=?, max_members=?, research_points=research_points+?, updated_at=? WHERE id=?', (level, _nova_guild_member_cap(level), points_add, _nova_guild_now_iso(), guild_id))
        _nova_guild_log(conn, guild_id, None, 'guild_level_up', None, {'level': level, 'research_points_added': points_add})


def nova_record_guild_contribution(conn, player_id: int, contribution_type='activity', raw_xp=0, quantity=1, source='activity', metadata=None) -> dict:
    nova_guild_ensure_tables(conn)
    member = _nova_guild_membership(conn, player_id)
    if not member:
        return {'ok': False, 'reason': 'player_not_in_guild'}
    guild_id = int(member['guild_id'])
    raw_xp = max(0, int(raw_xp or 0))
    if raw_xp <= 0:
        return {'ok': False, 'reason': 'no_xp'}
    day = _NovaGuildDatetime.now(_NovaGuildTimezone.utc).strftime('%Y-%m-%d')
    cap = _nova_guild_int(_nova_guild_setting(conn, 'daily_contribution_soft_cap', '2500'), 2500)
    over_mult = _nova_guild_float(_nova_guild_setting(conn, 'daily_contribution_overcap_multiplier', '0.20'), 0.20)
    existing = _nova_guild_row(conn, 'SELECT raw_xp FROM guild_contributions_daily WHERE guild_id=? AND player_id=? AND day=?', (guild_id, player_id, day))
    before = _nova_guild_int((existing or {}).get('raw_xp'), 0)
    full_value = max(0, min(raw_xp, max(0, cap - before)))
    over_value = max(0, raw_xp - full_value)
    effective = int(full_value + over_value * over_mult)
    type_map = {
        'material': 'material_xp', 'mining': 'material_xp', 'processing': 'material_xp', 'refining': 'material_xp',
        'money': 'money_xp', 'combat': 'combat_xp', 'crafting': 'crafting_xp', 'mission': 'mission_xp', 'war': 'war_xp'
    }
    col = type_map.get(str(contribution_type or '').lower(), 'other_xp')
    now = _nova_guild_now_iso()
    conn.execute(f'''INSERT INTO guild_contributions_daily(guild_id,player_id,day,{col},raw_xp,effective_xp,updated_at)
                     VALUES(?,?,?,?,?,?,?)
                     ON CONFLICT(guild_id,player_id,day) DO UPDATE SET
                       {col}={col}+excluded.{col}, raw_xp=raw_xp+excluded.raw_xp, effective_xp=effective_xp+excluded.effective_xp, updated_at=excluded.updated_at''',
                 (guild_id, player_id, day, effective, raw_xp, effective, now))
    conn.execute('''INSERT INTO guild_contribution_events(guild_id,player_id,contribution_type,raw_xp,effective_xp,quantity,source,metadata_json,created_at)
                   VALUES(?,?,?,?,?,?,?,?,?)''', (guild_id, player_id, str(contribution_type)[:40], raw_xp, effective, int(quantity or 1), str(source)[:80], _nova_guild_json_dumps(metadata or {}), now))
    conn.execute('UPDATE guild_members SET contribution_total=contribution_total+? WHERE guild_id=? AND player_id=?', (effective, guild_id, player_id))
    conn.execute('UPDATE guilds SET xp=xp+?, updated_at=? WHERE id=?', (effective, now, guild_id))
    _nova_guild_level_apply(conn, guild_id)
    return {'ok': True, 'guild_id': guild_id, 'raw_xp': raw_xp, 'effective_xp': effective, 'soft_capped': over_value > 0}


def _nova_guild_summary(conn, guild_id: int) -> dict:
    g = _nova_guild_row(conn, 'SELECT * FROM guilds WHERE id=? AND deleted_at IS NULL', (guild_id,))
    if not g:
        _nova_guild_raise(404, 'Guild not found')
    count = _nova_guild_row(conn, 'SELECT COUNT(*) AS n FROM guild_members WHERE guild_id=?', (guild_id,))
    active_wars = _nova_guild_row(conn, '''SELECT COUNT(*) AS n FROM guild_wars WHERE status IN ('pending','active') AND (attacker_guild_id=? OR defender_guild_id=?)''', (guild_id, guild_id))
    next_xp = _nova_guild_xp_required(min(_nova_guild_int(g.get('level'), 1) + 1, _nova_guild_int(_nova_guild_setting(conn, 'guild_max_level', '5'), 5)))
    out = dict(g)
    out['member_count'] = _nova_guild_int((count or {}).get('n'), 0)
    out['active_wars'] = _nova_guild_int((active_wars or {}).get('n'), 0)
    out['next_level_xp'] = next_xp
    return out


def _nova_guild_research_bonus_map(conn, guild_id: int) -> dict:
    rows = _nova_guild_rows(conn, '''SELECT d.bonus_type, d.bonus_per_rank, d.bonus_cap, gr.rank
                                    FROM guild_research gr JOIN guild_research_definitions d ON d.research_key=gr.research_key
                                    WHERE gr.guild_id=?''', (guild_id,))
    bonuses = {}
    for r in rows:
        value = min(_nova_guild_float(r.get('bonus_cap'), 0), _nova_guild_float(r.get('bonus_per_rank'), 0) * _nova_guild_int(r.get('rank'), 0))
        bonuses[r['bonus_type']] = value
    return bonuses


def _nova_guild_inventory_change(conn, player_id: int, planet_id: int, item_type: str, item_key: str, quantity_delta: int) -> None:
    # Safe adapter. It only touches known simple inventory schemas. If none is detected, the armory action is blocked.
    candidates = []
    if str(item_type).lower() in ('material','materials','ore','resource'):
        candidates = ['player_materials','materials_inventory','inventory_materials']
    else:
        candidates = ['player_items','inventory_items','player_inventory','inventory']
    for table in candidates:
        if not _nova_guild_table_exists(conn, table):
            continue
        cols = _nova_guild_cols(conn, table)
        player_col = _nova_guild_first_col(cols, ('player_id','user_id','owner_player_id'))
        planet_col = _nova_guild_first_col(cols, ('planet_id','location_planet_id','stored_planet_id'))
        qty_col = _nova_guild_first_col(cols, ('quantity','qty','amount','count'))
        key_col = _nova_guild_first_col(cols, ('item_key','material_key','template_key','name','material','item_name'))
        if not (player_col and planet_col and qty_col and key_col):
            continue
        row = _nova_guild_row(conn, f'SELECT rowid AS rid, {qty_col} AS qty FROM {table} WHERE {player_col}=? AND {planet_col}=? AND {key_col}=? LIMIT 1', (player_id, planet_id, item_key))
        current = _nova_guild_int((row or {}).get('qty'), 0)
        new_qty = current + int(quantity_delta)
        if new_qty < 0:
            _nova_guild_raise(400, 'Not enough inventory at this planet')
        if row:
            conn.execute(f'UPDATE {table} SET {qty_col}=? WHERE rowid=?', (new_qty, row['rid']))
        elif quantity_delta > 0:
            conn.execute(f'INSERT INTO {table}({player_col},{planet_col},{key_col},{qty_col}) VALUES(?,?,?,?)', (player_id, planet_id, item_key, new_qty))
        return
    _nova_guild_raise(501, 'Guild armory inventory adapter could not find a compatible planet-specific inventory table')


def _nova_guild_sanitize_target_type(v: str) -> str:
    v = str(v or 'guild').lower().strip()
    return 'planet' if v == 'planet' else 'guild'


@app.get('/api/guild/list')
def nova_guild_list(search: str = '', limit: int = 50):
    conn = _nova_guild_open_conn()
    try:
        nova_guild_ensure_tables(conn)
        q = f'%{str(search or '').strip()}%'
        rows = _nova_guild_rows(conn, '''SELECT g.*, COUNT(gm.player_id) AS member_count
                                       FROM guilds g LEFT JOIN guild_members gm ON gm.guild_id=g.id
                                       WHERE g.deleted_at IS NULL AND (?='' OR g.name LIKE ? OR g.tag LIKE ?)
                                       GROUP BY g.id ORDER BY g.level DESC, member_count DESC, g.name ASC LIMIT ?''', (str(search or '').strip(), q, q, max(1, min(int(limit or 50), 100))))
        return {'guilds': rows}
    finally:
        try: conn.close()
        except Exception: pass


@app.get('/api/guild/me')
def nova_guild_me(player_id: int):
    conn = _nova_guild_open_conn()
    try:
        nova_guild_ensure_tables(conn)
        player = _nova_guild_player(conn, player_id)
        if not player:
            _nova_guild_raise(404, 'Player not found')
        member = _nova_guild_membership(conn, player_id)
        invites = _nova_guild_rows(conn, '''SELECT gi.*, g.name AS guild_name, g.tag AS guild_tag
                                         FROM guild_invites gi JOIN guilds g ON g.id=gi.guild_id
                                         WHERE gi.recipient_player_id=? AND gi.status='pending' ORDER BY gi.id DESC''', (player_id,))
        if not member:
            return {'player': player, 'membership': None, 'guild': None, 'invites': invites}
        guild = _nova_guild_summary(conn, int(member['guild_id']))
        guild['research_bonuses'] = _nova_guild_research_bonus_map(conn, int(member['guild_id']))
        return {'player': player, 'membership': member, 'guild': guild, 'invites': invites}
    finally:
        try: conn.close()
        except Exception: pass


@app.get('/api/guild/roster')
def nova_guild_roster(player_id: int, guild_id: int):
    conn = _nova_guild_open_conn()
    try:
        nova_guild_ensure_tables(conn)
        _nova_guild_require_membership(conn, player_id, guild_id)
        rows = _nova_guild_rows(conn, '''SELECT gm.player_id, gm.joined_at, gm.contribution_total, gr.id AS rank_id, gr.name AS rank_name, gr.sort_order AS rank_order
                                       FROM guild_members gm JOIN guild_ranks gr ON gr.id=gm.rank_id
                                       WHERE gm.guild_id=? ORDER BY gr.sort_order DESC, gm.contribution_total DESC''', (guild_id,))
        for r in rows:
            p = _nova_guild_player(conn, int(r['player_id']))
            r['username'] = (p or {}).get('username') or f"Player {r['player_id']}"
        ranks = _nova_guild_rows(conn, 'SELECT * FROM guild_ranks WHERE guild_id=? ORDER BY sort_order DESC', (guild_id,))
        return {'members': rows, 'ranks': ranks}
    finally:
        try: conn.close()
        except Exception: pass


@app.get('/api/guild/detail')
def nova_guild_detail(guild_id: int, player_id: int = 0):
    conn = _nova_guild_open_conn()
    try:
        nova_guild_ensure_tables(conn)
        guild = _nova_guild_summary(conn, guild_id)
        member = _nova_guild_membership(conn, player_id) if player_id else None
        return {'guild': guild, 'membership': member if member and int(member['guild_id']) == int(guild_id) else None}
    finally:
        try: conn.close()
        except Exception: pass


@app.post('/api/guild/create')
def nova_guild_create(req: NovaGuildCreateRequest):
    name = _nova_guild_clamp_text(req.name, 64)
    tag = _nova_guild_clamp_text(req.tag, 8).upper()
    if len(name) < 3 or len(tag) < 2:
        _nova_guild_raise(400, 'Guild name/tag too short')
    status = str(req.status or 'public').lower()
    if status not in ('public','private','invite'):
        status = 'public'
    conn = _nova_guild_open_conn()
    try:
        nova_guild_ensure_tables(conn)
        conn.execute('BEGIN IMMEDIATE')
        player = _nova_guild_player(conn, req.player_id)
        if not player:
            _nova_guild_raise(404, 'Player not found')
        if _nova_guild_membership(conn, req.player_id):
            _nova_guild_raise(400, 'You are already in a guild')
        planet_id = player.get('planet_id')
        if planet_id is None:
            _nova_guild_raise(400, 'You must be docked at a planet to create a guild')
        cost = _nova_guild_int(_nova_guild_setting(conn, 'guild_creation_cost', '25000'), 25000)
        _nova_guild_update_player_money(conn, req.player_id, -cost)
        now = _nova_guild_now_iso()
        cur = conn.execute('''INSERT INTO guilds(name,tag,description,faction_id,founder_player_id,leader_player_id,home_planet_id,level,xp,research_points,treasury,max_members,status,created_at,updated_at)
                              VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''', (name, tag, _nova_guild_clamp_text(req.description, 500), str(player.get('faction_id') or ''), req.player_id, req.player_id, planet_id, 1, 0, 0, 0, 10, status, now, now))
        guild_id = int(cur.lastrowid)
        _nova_guild_create_default_ranks(conn, guild_id)
        leader_rank = _nova_guild_rank_by_name(conn, guild_id, 'Leader')
        conn.execute('INSERT INTO guild_members(guild_id,player_id,rank_id,joined_at) VALUES(?,?,?,?)', (guild_id, req.player_id, leader_rank['id'], now))
        _nova_guild_log(conn, guild_id, req.player_id, 'guild_created', req.player_id, {'cost': cost})
        conn.commit()
        return {'ok': True, 'guild': _nova_guild_summary(conn, guild_id)}
    except Exception:
        try: conn.rollback()
        except Exception: pass
        raise
    finally:
        try: conn.close()
        except Exception: pass


@app.post('/api/guild/apply')
def nova_guild_apply(req: NovaGuildApplyRequest):
    conn = _nova_guild_open_conn()
    try:
        nova_guild_ensure_tables(conn)
        if _nova_guild_membership(conn, req.player_id):
            _nova_guild_raise(400, 'You are already in a guild')
        guild = _nova_guild_summary(conn, req.guild_id)
        if guild.get('status') == 'private':
            _nova_guild_raise(400, 'Guild is private')
        conn.execute('''INSERT OR REPLACE INTO guild_applications(guild_id,player_id,message,status,created_at)
                       VALUES(?,?,?,?,?)''', (req.guild_id, req.player_id, _nova_guild_clamp_text(req.message, 500), 'pending', _nova_guild_now_iso()))
        _nova_guild_log(conn, req.guild_id, req.player_id, 'application_created', req.player_id, {})
        conn.commit()
        return {'ok': True}
    finally:
        try: conn.close()
        except Exception: pass


@app.post('/api/guild/invite')
def nova_guild_invite(req: NovaGuildInviteRequest):
    conn = _nova_guild_open_conn()
    try:
        nova_guild_ensure_tables(conn)
        actor = _nova_guild_require_membership(conn, req.player_id, req.guild_id)
        if not _nova_guild_has_perm(actor, 'can_invite'):
            _nova_guild_raise(403, 'Invite permission required')
        recipient_id = req.recipient_id
        if not recipient_id and req.recipient_name:
            p = _nova_guild_player_by_name(conn, req.recipient_name)
            if p: recipient_id = int(p['id'])
        if not recipient_id:
            _nova_guild_raise(404, 'Recipient not found')
        if _nova_guild_membership(conn, recipient_id):
            _nova_guild_raise(400, 'Recipient is already in a guild')
        conn.execute('''INSERT INTO guild_invites(guild_id,sender_player_id,recipient_player_id,message,status,created_at)
                       VALUES(?,?,?,?,?,?)''', (req.guild_id, req.player_id, recipient_id, _nova_guild_clamp_text(req.message, 500), 'pending', _nova_guild_now_iso()))
        _nova_guild_log(conn, req.guild_id, req.player_id, 'invite_sent', recipient_id, {})
        conn.commit()
        return {'ok': True}
    finally:
        try: conn.close()
        except Exception: pass


@app.post('/api/guild/invite/respond')
def nova_guild_invite_respond(req: NovaGuildInviteRespondRequest):
    conn = _nova_guild_open_conn()
    try:
        nova_guild_ensure_tables(conn)
        conn.execute('BEGIN IMMEDIATE')
        inv = _nova_guild_row(conn, 'SELECT * FROM guild_invites WHERE id=? AND recipient_player_id=? AND status="pending"', (req.invite_id, req.player_id))
        if not inv:
            _nova_guild_raise(404, 'Invite not found')
        if _nova_guild_membership(conn, req.player_id):
            _nova_guild_raise(400, 'You are already in a guild')
        status = 'accepted' if req.accept else 'declined'
        conn.execute('UPDATE guild_invites SET status=?, resolved_at=? WHERE id=?', (status, _nova_guild_now_iso(), req.invite_id))
        if req.accept:
            g = _nova_guild_summary(conn, int(inv['guild_id']))
            if int(g['member_count']) >= int(g['max_members']):
                _nova_guild_raise(400, 'Guild is full')
            rank = _nova_guild_default_rank(conn, int(inv['guild_id']))
            conn.execute('INSERT INTO guild_members(guild_id,player_id,rank_id,joined_at) VALUES(?,?,?,?)', (inv['guild_id'], req.player_id, rank['id'], _nova_guild_now_iso()))
            _nova_guild_log(conn, int(inv['guild_id']), req.player_id, 'member_joined_by_invite', req.player_id, {})
        conn.commit()
        return {'ok': True, 'status': status}
    except Exception:
        try: conn.rollback()
        except Exception: pass
        raise
    finally:
        try: conn.close()
        except Exception: pass


@app.post('/api/guild/leave')
def nova_guild_leave(req: NovaGuildLeaveRequest):
    conn = _nova_guild_open_conn()
    try:
        nova_guild_ensure_tables(conn)
        member = _nova_guild_require_membership(conn, req.player_id, req.guild_id)
        if str(member.get('rank_name')) == 'Leader':
            count = _nova_guild_int((_nova_guild_row(conn, 'SELECT COUNT(*) AS n FROM guild_members WHERE guild_id=?', (req.guild_id,)) or {}).get('n'), 0)
            if count > 1:
                _nova_guild_raise(400, 'Transfer leadership before leaving')
        active_war = _nova_guild_row(conn, '''SELECT id FROM guild_wars WHERE status IN ('pending','active') AND (attacker_guild_id=? OR defender_guild_id=?) LIMIT 1''', (req.guild_id, req.guild_id))
        if active_war and str(member.get('rank_name')) in ('Leader','Officer'):
            _nova_guild_raise(400, 'Leaders/officers cannot leave during active war')
        conn.execute('DELETE FROM guild_members WHERE guild_id=? AND player_id=?', (req.guild_id, req.player_id))
        _nova_guild_log(conn, req.guild_id, req.player_id, 'member_left', req.player_id, {'active_war': bool(active_war)})
        conn.commit()
        return {'ok': True}
    finally:
        try: conn.close()
        except Exception: pass


@app.post('/api/guild/kick')
def nova_guild_kick(req: NovaGuildKickRequest):
    conn = _nova_guild_open_conn()
    try:
        nova_guild_ensure_tables(conn)
        actor = _nova_guild_require_membership(conn, req.player_id, req.guild_id)
        if not _nova_guild_has_perm(actor, 'can_kick'):
            _nova_guild_raise(403, 'Kick permission required')
        target = _nova_guild_require_membership(conn, req.target_player_id, req.guild_id)
        if _nova_guild_int(target.get('rank_order'), 0) >= _nova_guild_int(actor.get('rank_order'), 0):
            _nova_guild_raise(403, 'Cannot kick same/higher rank')
        conn.execute('DELETE FROM guild_members WHERE guild_id=? AND player_id=?', (req.guild_id, req.target_player_id))
        _nova_guild_log(conn, req.guild_id, req.player_id, 'member_kicked', req.target_player_id, {})
        conn.commit()
        return {'ok': True}
    finally:
        try: conn.close()
        except Exception: pass


@app.post('/api/guild/rank/update')
def nova_guild_rank_update(req: NovaGuildRankUpdateRequest):
    conn = _nova_guild_open_conn()
    try:
        nova_guild_ensure_tables(conn)
        actor = _nova_guild_require_membership(conn, req.player_id, req.guild_id)
        if not (_nova_guild_has_perm(actor, 'can_promote') or _nova_guild_has_perm(actor, 'can_demote') or _nova_guild_has_perm(actor, 'can_manage_ranks')):
            _nova_guild_raise(403, 'Rank permission required')
        target = _nova_guild_require_membership(conn, req.target_player_id, req.guild_id)
        new_rank = _nova_guild_row(conn, 'SELECT * FROM guild_ranks WHERE guild_id=? AND id=?', (req.guild_id, req.rank_id))
        if not new_rank:
            _nova_guild_raise(404, 'Rank not found')
        if _nova_guild_int(target.get('rank_order'), 0) >= _nova_guild_int(actor.get('rank_order'), 0) or _nova_guild_int(new_rank.get('sort_order'), 0) >= _nova_guild_int(actor.get('rank_order'), 0):
            _nova_guild_raise(403, 'Cannot change same/higher rank')
        conn.execute('UPDATE guild_members SET rank_id=? WHERE guild_id=? AND player_id=?', (req.rank_id, req.guild_id, req.target_player_id))
        _nova_guild_log(conn, req.guild_id, req.player_id, 'rank_updated', req.target_player_id, {'rank_id': req.rank_id})
        conn.commit()
        return {'ok': True}
    finally:
        try: conn.close()
        except Exception: pass


@app.get('/api/guild/contributions')
def nova_guild_contributions(player_id: int, guild_id: int):
    conn = _nova_guild_open_conn()
    try:
        nova_guild_ensure_tables(conn)
        _nova_guild_require_membership(conn, player_id, guild_id)
        today = _NovaGuildDatetime.now(_NovaGuildTimezone.utc).strftime('%Y-%m-%d')
        daily = _nova_guild_rows(conn, 'SELECT * FROM guild_contributions_daily WHERE guild_id=? ORDER BY day DESC, effective_xp DESC LIMIT 200', (guild_id,))
        events = _nova_guild_rows(conn, 'SELECT * FROM guild_contribution_events WHERE guild_id=? ORDER BY id DESC LIMIT 100', (guild_id,))
        return {'today': today, 'daily': daily, 'events': events}
    finally:
        try: conn.close()
        except Exception: pass


@app.post('/api/guild/contributions/record')
def nova_guild_contribution_record(req: NovaGuildContributionRequest):
    conn = _nova_guild_open_conn()
    try:
        result = nova_record_guild_contribution(conn, req.player_id, req.contribution_type, req.xp, req.quantity, req.source, req.metadata)
        conn.commit()
        return result
    finally:
        try: conn.close()
        except Exception: pass


@app.get('/api/guild/research')
def nova_guild_research(player_id: int, guild_id: int):
    conn = _nova_guild_open_conn()
    try:
        nova_guild_ensure_tables(conn)
        _nova_guild_require_membership(conn, player_id, guild_id)
        guild = _nova_guild_summary(conn, guild_id)
        defs = _nova_guild_rows(conn, '''SELECT d.*, COALESCE(gr.rank,0) AS current_rank
                                      FROM guild_research_definitions d LEFT JOIN guild_research gr
                                      ON gr.research_key=d.research_key AND gr.guild_id=?
                                      ORDER BY d.category, d.sort_order''', (guild_id,))
        return {'guild': guild, 'definitions': defs, 'bonuses': _nova_guild_research_bonus_map(conn, guild_id)}
    finally:
        try: conn.close()
        except Exception: pass


@app.post('/api/guild/research/unlock')
def nova_guild_research_unlock(req: NovaGuildResearchUnlockRequest):
    conn = _nova_guild_open_conn()
    try:
        nova_guild_ensure_tables(conn)
        conn.execute('BEGIN IMMEDIATE')
        member = _nova_guild_require_membership(conn, req.player_id, req.guild_id)
        if not _nova_guild_has_perm(member, 'can_start_research'):
            _nova_guild_raise(403, 'Research permission required')
        guild = _nova_guild_summary(conn, req.guild_id)
        d = _nova_guild_row(conn, 'SELECT * FROM guild_research_definitions WHERE research_key=?', (req.research_key,))
        if not d:
            _nova_guild_raise(404, 'Research not found')
        if _nova_guild_int(guild.get('level'), 1) < _nova_guild_int(d.get('required_guild_level'), 1):
            _nova_guild_raise(400, 'Guild level too low')
        cur = _nova_guild_row(conn, 'SELECT rank FROM guild_research WHERE guild_id=? AND research_key=?', (req.guild_id, req.research_key))
        current_rank = _nova_guild_int((cur or {}).get('rank'), 0)
        if current_rank >= _nova_guild_int(d.get('max_rank'), 5):
            _nova_guild_raise(400, 'Research already maxed')
        cost = _nova_guild_int(d.get('points_per_rank'), 1)
        if _nova_guild_int(guild.get('research_points'), 0) < cost:
            _nova_guild_raise(400, 'Not enough research points')
        now = _nova_guild_now_iso()
        conn.execute('UPDATE guilds SET research_points=research_points-?, updated_at=? WHERE id=?', (cost, now, req.guild_id))
        conn.execute('''INSERT INTO guild_research(guild_id,research_key,rank,updated_at) VALUES(?,?,?,?)
                       ON CONFLICT(guild_id,research_key) DO UPDATE SET rank=rank+1, updated_at=excluded.updated_at''', (req.guild_id, req.research_key, 1, now))
        _nova_guild_log(conn, req.guild_id, req.player_id, 'research_unlocked', None, {'research_key': req.research_key, 'new_rank': current_rank + 1})
        conn.commit()
        return {'ok': True, 'new_rank': current_rank + 1}
    except Exception:
        try: conn.rollback()
        except Exception: pass
        raise
    finally:
        try: conn.close()
        except Exception: pass


@app.get('/api/guild/armory')
def nova_guild_armory(player_id: int, guild_id: int, planet_id: int = None):
    conn = _nova_guild_open_conn()
    try:
        nova_guild_ensure_tables(conn)
        _nova_guild_require_membership(conn, player_id, guild_id)
        player = _nova_guild_player(conn, player_id)
        pid = planet_id or (player or {}).get('planet_id')
        if pid is None:
            _nova_guild_raise(400, 'Dock at a planet to view local armory')
        rows = _nova_guild_rows(conn, 'SELECT * FROM guild_armory WHERE guild_id=? AND planet_id=? AND quantity>0 ORDER BY item_type,item_name,item_key', (guild_id, pid))
        return {'planet_id': pid, 'items': rows}
    finally:
        try: conn.close()
        except Exception: pass


@app.post('/api/guild/armory/deposit')
def nova_guild_armory_deposit(req: NovaGuildArmoryMoveRequest):
    qty = max(1, int(req.quantity or 1))
    conn = _nova_guild_open_conn()
    try:
        nova_guild_ensure_tables(conn)
        conn.execute('BEGIN IMMEDIATE')
        member = _nova_guild_require_membership(conn, req.player_id, req.guild_id)
        if not _nova_guild_has_perm(member, 'can_deposit_armory'):
            _nova_guild_raise(403, 'Deposit permission required')
        player = _nova_guild_player(conn, req.player_id)
        planet_id = req.planet_id or (player or {}).get('planet_id')
        if planet_id is None or str(planet_id) != str((player or {}).get('planet_id')):
            _nova_guild_raise(400, 'You must be docked at this planet')
        _nova_guild_inventory_change(conn, req.player_id, int(planet_id), req.item_type, req.item_key, -qty)
        now = _nova_guild_now_iso()
        conn.execute('''INSERT INTO guild_armory(guild_id,planet_id,item_type,item_key,item_name,quantity,tier,quality,deposited_by,created_at,updated_at)
                       VALUES(?,?,?,?,?,?,?,?,?,?,?)
                       ON CONFLICT(guild_id,planet_id,item_type,item_key,tier,quality) DO UPDATE SET
                         quantity=quantity+excluded.quantity, deposited_by=excluded.deposited_by, updated_at=excluded.updated_at''',
                     (req.guild_id, int(planet_id), req.item_type, req.item_key, _nova_guild_clamp_text(req.item_name or req.item_key, 120), qty, _nova_guild_clamp_text(req.tier, 40), _nova_guild_clamp_text(req.quality, 40), req.player_id, now, now))
        _nova_guild_log(conn, req.guild_id, req.player_id, 'armory_deposit', None, _nova_guild_req_dict(req))
        conn.commit()
        return {'ok': True}
    except Exception:
        try: conn.rollback()
        except Exception: pass
        raise
    finally:
        try: conn.close()
        except Exception: pass


@app.post('/api/guild/armory/withdraw')
def nova_guild_armory_withdraw(req: NovaGuildArmoryMoveRequest):
    qty = max(1, int(req.quantity or 1))
    conn = _nova_guild_open_conn()
    try:
        nova_guild_ensure_tables(conn)
        conn.execute('BEGIN IMMEDIATE')
        member = _nova_guild_require_membership(conn, req.player_id, req.guild_id)
        if not (_nova_guild_has_perm(member, 'can_withdraw_armory') or _nova_guild_has_perm(member, 'can_manage_armory')):
            _nova_guild_raise(403, 'Withdraw permission required')
        lock_seconds = _nova_guild_int(_nova_guild_setting(conn, 'new_member_armory_lock_seconds', '86400'), 86400)
        try:
            joined_ts = _NovaGuildDatetime.fromisoformat(str(member.get('joined_at')).replace('Z','+00:00')).timestamp()
        except Exception:
            joined_ts = 0
        if lock_seconds > 0 and _nova_guild_time.time() - joined_ts < lock_seconds and str(member.get('rank_name')) not in ('Leader','Officer'):
            _nova_guild_raise(403, 'New member armory withdrawal lock is active')
        player = _nova_guild_player(conn, req.player_id)
        planet_id = req.planet_id or (player or {}).get('planet_id')
        if planet_id is None or str(planet_id) != str((player or {}).get('planet_id')):
            _nova_guild_raise(400, 'You must be docked at this planet')
        item = _nova_guild_row(conn, '''SELECT * FROM guild_armory WHERE guild_id=? AND planet_id=? AND item_type=? AND item_key=? AND tier=? AND quality=? LIMIT 1''',
                               (req.guild_id, int(planet_id), req.item_type, req.item_key, _nova_guild_clamp_text(req.tier, 40), _nova_guild_clamp_text(req.quality, 40)))
        if not item or _nova_guild_int(item.get('quantity'), 0) < qty:
            _nova_guild_raise(400, 'Not enough item quantity in this planet armory')
        if _nova_guild_int(item.get('locked'), 0) and not _nova_guild_has_perm(member, 'can_manage_armory'):
            _nova_guild_raise(403, 'Item is locked')
        _nova_guild_inventory_change(conn, req.player_id, int(planet_id), req.item_type, req.item_key, qty)
        conn.execute('UPDATE guild_armory SET quantity=quantity-?, last_withdrawn_by=?, updated_at=? WHERE id=?', (qty, req.player_id, _nova_guild_now_iso(), item['id']))
        _nova_guild_log(conn, req.guild_id, req.player_id, 'armory_withdraw', req.player_id, _nova_guild_req_dict(req))
        conn.commit()
        return {'ok': True}
    except Exception:
        try: conn.rollback()
        except Exception: pass
        raise
    finally:
        try: conn.close()
        except Exception: pass


@app.get('/api/guild/treasury')
def nova_guild_treasury(player_id: int, guild_id: int):
    conn = _nova_guild_open_conn()
    try:
        nova_guild_ensure_tables(conn)
        _nova_guild_require_membership(conn, player_id, guild_id)
        guild = _nova_guild_summary(conn, guild_id)
        logs = _nova_guild_rows(conn, 'SELECT * FROM guild_treasury_log WHERE guild_id=? ORDER BY id DESC LIMIT 100', (guild_id,))
        return {'treasury': guild.get('treasury'), 'tax_percent': guild.get('tax_percent'), 'logs': logs}
    finally:
        try: conn.close()
        except Exception: pass


@app.post('/api/guild/treasury/deposit')
def nova_guild_treasury_deposit(req: NovaGuildTreasuryDepositRequest):
    amount = max(1, int(req.amount or 0))
    conn = _nova_guild_open_conn()
    try:
        nova_guild_ensure_tables(conn)
        conn.execute('BEGIN IMMEDIATE')
        _nova_guild_require_membership(conn, req.player_id, req.guild_id)
        _nova_guild_update_player_money(conn, req.player_id, -amount)
        conn.execute('UPDATE guilds SET treasury=treasury+?, updated_at=? WHERE id=?', (amount, _nova_guild_now_iso(), req.guild_id))
        balance = _nova_guild_int((_nova_guild_row(conn, 'SELECT treasury FROM guilds WHERE id=?', (req.guild_id,)) or {}).get('treasury'), 0)
        conn.execute('INSERT INTO guild_treasury_log(guild_id,player_id,amount,balance_after,reason,created_at) VALUES(?,?,?,?,?,?)', (req.guild_id, req.player_id, amount, balance, 'deposit', _nova_guild_now_iso()))
        _nova_guild_log(conn, req.guild_id, req.player_id, 'treasury_deposit', None, {'amount': amount})
        nova_record_guild_contribution(conn, req.player_id, 'money', max(1, amount // 100), amount, 'treasury_deposit', {'amount': amount})
        conn.commit()
        return {'ok': True, 'balance': balance}
    except Exception:
        try: conn.rollback()
        except Exception: pass
        raise
    finally:
        try: conn.close()
        except Exception: pass


@app.post('/api/guild/war/declare')
def nova_guild_war_declare(req: NovaGuildWarDeclareRequest):
    conn = _nova_guild_open_conn()
    try:
        nova_guild_ensure_tables(conn)
        conn.execute('BEGIN IMMEDIATE')
        member = _nova_guild_require_membership(conn, req.player_id, req.guild_id)
        if not _nova_guild_has_perm(member, 'can_declare_war'):
            _nova_guild_raise(403, 'War declaration permission required')
        target_type = _nova_guild_sanitize_target_type(req.target_type)
        attacker = _nova_guild_summary(conn, req.guild_id)
        if target_type == 'guild':
            if not req.target_guild_id or int(req.target_guild_id) == int(req.guild_id):
                _nova_guild_raise(400, 'Valid target guild required')
            defender = _nova_guild_summary(conn, req.target_guild_id)
            base = _nova_guild_int(_nova_guild_setting(conn, 'guild_war_base_cost', '50000'), 50000)
            cost = base + int(attacker['level']) * 5000 + int(defender['level']) * 5000
            target_planet_id = None
            defender_id = req.target_guild_id
            duration = _nova_guild_int(_nova_guild_setting(conn, 'guild_war_duration_seconds', '86400'), 86400)
        else:
            if not req.target_planet_id:
                _nova_guild_raise(400, 'Target planet required')
            base = _nova_guild_int(_nova_guild_setting(conn, 'planet_war_base_cost', '150000'), 150000)
            cost = base + int(attacker['level']) * 10000
            target_planet_id = req.target_planet_id
            defender_id = None
            duration = _nova_guild_int(_nova_guild_setting(conn, 'planet_war_duration_seconds', '172800'), 172800)
        bonuses = _nova_guild_research_bonus_map(conn, req.guild_id)
        cost = int(cost * max(0.5, 1.0 - (_nova_guild_float(bonuses.get('war_cost_reduction_pct'), 0) / 100.0)))
        if _nova_guild_int(attacker.get('treasury'), 0) < cost:
            _nova_guild_raise(400, 'Guild treasury cannot pay war cost')
        recent = _nova_guild_row(conn, '''SELECT id FROM guild_wars WHERE attacker_guild_id=? AND COALESCE(defender_guild_id,0)=COALESCE(?,0) AND COALESCE(target_planet_id,0)=COALESCE(?,0)
                                      AND declared_at >= datetime('now', '-' || ? || ' seconds') LIMIT 1''', (req.guild_id, defender_id or 0, target_planet_id or 0, _nova_guild_int(_nova_guild_setting(conn, 'guild_war_cooldown_seconds', '172800'), 172800)))
        if recent:
            _nova_guild_raise(400, 'War cooldown against this target is active')
        now_ts = _nova_guild_time.time()
        prep = _nova_guild_int(_nova_guild_setting(conn, 'guild_war_prep_seconds', '1800'), 1800)
        now_iso = _nova_guild_now_iso()
        starts = _NovaGuildDatetime.fromtimestamp(now_ts + prep, _NovaGuildTimezone.utc).isoformat()
        ends = _NovaGuildDatetime.fromtimestamp(now_ts + prep + duration, _NovaGuildTimezone.utc).isoformat()
        conn.execute('UPDATE guilds SET treasury=treasury-?, updated_at=? WHERE id=?', (cost, now_iso, req.guild_id))
        balance = _nova_guild_int((_nova_guild_row(conn, 'SELECT treasury FROM guilds WHERE id=?', (req.guild_id,)) or {}).get('treasury'), 0)
        conn.execute('INSERT INTO guild_treasury_log(guild_id,player_id,amount,balance_after,reason,created_at) VALUES(?,?,?,?,?,?)', (req.guild_id, req.player_id, -cost, balance, f'{target_type}_war_declaration', now_iso))
        cur = conn.execute('''INSERT INTO guild_wars(attacker_guild_id,defender_guild_id,target_planet_id,target_type,status,declaration_cost,reason,declared_by,declared_at,prep_ends_at,starts_at,ends_at,metadata_json)
                              VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)''', (req.guild_id, defender_id, target_planet_id, target_type, 'pending', cost, _nova_guild_clamp_text(req.reason, 500), req.player_id, now_iso, starts, starts, ends, _nova_guild_json_dumps({})))
        war_id = int(cur.lastrowid)
        conn.execute('INSERT OR IGNORE INTO guild_war_scores(war_id,guild_id,updated_at) VALUES(?,?,?)', (war_id, req.guild_id, now_iso))
        if defender_id:
            conn.execute('INSERT OR IGNORE INTO guild_war_scores(war_id,guild_id,updated_at) VALUES(?,?,?)', (war_id, defender_id, now_iso))
        _nova_guild_log(conn, req.guild_id, req.player_id, 'war_declared', None, {'war_id': war_id, 'target_type': target_type, 'cost': cost})
        conn.commit()
        return {'ok': True, 'war_id': war_id, 'cost': cost, 'starts_at': starts, 'ends_at': ends}
    except Exception:
        try: conn.rollback()
        except Exception: pass
        raise
    finally:
        try: conn.close()
        except Exception: pass


@app.post('/api/guild/war/surrender')
def nova_guild_war_surrender(req: NovaGuildWarSurrenderRequest):
    conn = _nova_guild_open_conn()
    try:
        nova_guild_ensure_tables(conn)
        member = _nova_guild_require_membership(conn, req.player_id, req.guild_id)
        if not _nova_guild_has_perm(member, 'can_manage_war'):
            _nova_guild_raise(403, 'War management permission required')
        war = _nova_guild_row(conn, 'SELECT * FROM guild_wars WHERE id=? AND status IN ("pending","active")', (req.war_id,))
        if not war:
            _nova_guild_raise(404, 'Active war not found')
        if int(war.get('attacker_guild_id') or 0) != int(req.guild_id) and int(war.get('defender_guild_id') or 0) != int(req.guild_id):
            _nova_guild_raise(403, 'Guild is not in this war')
        other = int(war.get('defender_guild_id') or 0) if int(war.get('attacker_guild_id') or 0) == int(req.guild_id) else int(war.get('attacker_guild_id') or 0)
        conn.execute('UPDATE guild_wars SET status="surrendered", resolved_at=?, winner_guild_id=? WHERE id=?', (_nova_guild_now_iso(), other or None, req.war_id))
        _nova_guild_log(conn, req.guild_id, req.player_id, 'war_surrendered', None, {'war_id': req.war_id})
        conn.commit()
        return {'ok': True, 'winner_guild_id': other or None}
    finally:
        try: conn.close()
        except Exception: pass


@app.get('/api/guild/wars')
def nova_guild_wars(player_id: int, guild_id: int):
    conn = _nova_guild_open_conn()
    try:
        nova_guild_ensure_tables(conn)
        _nova_guild_require_membership(conn, player_id, guild_id)
        rows = _nova_guild_rows(conn, '''SELECT * FROM guild_wars WHERE attacker_guild_id=? OR defender_guild_id=? ORDER BY id DESC LIMIT 100''', (guild_id, guild_id))
        scores = {}
        if rows:
            ids = tuple(int(r['id']) for r in rows)
            placeholders = ','.join(['?'] * len(ids))
            for s in _nova_guild_rows(conn, f'SELECT * FROM guild_war_scores WHERE war_id IN ({placeholders})', ids):
                scores.setdefault(str(s['war_id']), []).append(s)
        return {'wars': rows, 'scores': scores}
    finally:
        try: conn.close()
        except Exception: pass


@app.get('/api/guild/logs')
def nova_guild_logs(player_id: int, guild_id: int, limit: int = 100):
    conn = _nova_guild_open_conn()
    try:
        nova_guild_ensure_tables(conn)
        _nova_guild_require_membership(conn, player_id, guild_id)
        rows = _nova_guild_rows(conn, 'SELECT * FROM guild_logs WHERE guild_id=? ORDER BY id DESC LIMIT ?', (guild_id, max(1, min(int(limit or 100), 250))))
        return {'logs': rows}
    finally:
        try: conn.close()
        except Exception: pass


@app.get('/api/admin/guild/settings')
def nova_admin_guild_settings(player_id: int = 0):
    conn = _nova_guild_open_conn()
    try:
        nova_guild_ensure_tables(conn)
        return {'settings': _nova_guild_settings(conn)}
    finally:
        try: conn.close()
        except Exception: pass


@app.post('/api/admin/guild/settings')
def nova_admin_guild_settings_update(req: NovaGuildSettingsRequest):
    # If the project has its own admin auth dependency, wire it here. This endpoint is isolated for tuning only.
    allowed = {
        'guild_creation_cost','guild_max_level','daily_contribution_soft_cap','daily_contribution_overcap_multiplier',
        'new_member_armory_lock_seconds','guild_tax_max_percent','guild_war_prep_seconds','guild_war_duration_seconds',
        'guild_war_cooldown_seconds','guild_war_base_cost','planet_war_base_cost','planet_war_duration_seconds','planet_war_min_security'
    }
    conn = _nova_guild_open_conn()
    try:
        nova_guild_ensure_tables(conn)
        now = _nova_guild_now_iso()
        for k, v in (_nova_guild_req_dict(req).get('settings') or {}).items():
            if k in allowed:
                conn.execute('INSERT OR REPLACE INTO guild_settings(key,value,updated_at) VALUES(?,?,?)', (k, str(v), now))
        conn.commit()
        return {'ok': True, 'settings': _nova_guild_settings(conn)}
    finally:
        try: conn.close()
        except Exception: pass
"""

    text = text.rstrip() + block + '\n'
    write_if_changed(BACKEND, original, text, 'backend/app/main.py')


def patch_frontend() -> None:
    text = read_text(FRONTEND)
    original = text
    if FRONTEND_MARKER in text:
        skipped.append('frontend/src/main.jsx: guild frontend marker already present')
        return

    block = r"""

// NOVA_GUILD_SYSTEM_FRONTEND_V1
// Self-contained Guild UI shell. It loads guild data on the Guild page only; it does not expand /api/state.
(function novaGuildSystemFrontend(){
  if (typeof window === 'undefined' || window.__novaGuildSystemFrontendV1) return;
  window.__novaGuildSystemFrontendV1 = true;

  const stateCache = { value: null, at: 0 };
  const app = { open: false, tab: localStorage.getItem('novaGuildTab') || 'overview', me: null, roster: null, contributions: null, research: null, armory: null, treasury: null, wars: null, logs: null, guilds: null, err: '' };

  async function apiJson(url, options = {}) {
    const res = await fetch(url, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok) {
      const err = new Error(data?.detail || data?.error || `Request failed (${res.status})`);
      err.data = data;
      err.status = res.status;
      throw err;
    }
    return data;
  }
  function esc(v){ return String(v ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch])); }
  function qs(s){ return document.querySelector(s); }
  function qsa(s){ return Array.from(document.querySelectorAll(s)); }
  function normalizeState(data){ return data?.state || data || {}; }
  async function getState(force=false){
    if (!force && stateCache.value && Date.now() - stateCache.at < 15000) return stateCache.value;
    const data = normalizeState(await apiJson('/api/state'));
    stateCache.value = data; stateCache.at = Date.now();
    return data;
  }
  function playerIdFromState(state){
    const p = state?.player || state?.profile || state?.current_player || state?.user || {};
    return p.id ?? p.player_id ?? state?.player_id ?? localStorage.getItem('novaPlayerId') ?? 1;
  }
  async function currentPlayerId(){ return playerIdFromState(await getState()); }

  function ensureNav(){
    if (qs('[data-nova-guild-nav]')) return;
    const host = qs('nav') || qs('header') || qs('.nav') || qs('.sidebar') || document.body;
    const btn = document.createElement(host.tagName === 'NAV' || host.tagName === 'HEADER' ? 'button' : 'button');
    btn.type = 'button';
    btn.textContent = 'Guild';
    btn.className = 'nova-guild-nav-btn';
    btn.setAttribute('data-nova-guild-nav','1');
    btn.addEventListener('click', () => openGuildPage());
    host.appendChild(btn);
  }

  function ensureRoot(){
    let root = qs('[data-nova-guild-root]');
    if (root) return root;
    root = document.createElement('section');
    root.setAttribute('data-nova-guild-root', '1');
    root.className = 'nova-guild-root';
    root.hidden = true;
    document.body.appendChild(root);
    return root;
  }

  function openGuildPage(){
    app.open = true;
    location.hash = 'guild';
    ensureRoot().hidden = false;
    loadAll().catch(showError);
  }
  function closeGuildPage(){ app.open = false; ensureRoot().hidden = true; }
  function setTab(tab){ app.tab = tab; localStorage.setItem('novaGuildTab', tab); render(); loadTab(tab).catch(showError); }
  function showError(e){ app.err = e?.message || String(e); render(); }

  async function loadMe(){
    const player_id = await currentPlayerId();
    app.me = await apiJson(`/api/guild/me?player_id=${encodeURIComponent(player_id)}`);
    app.err = '';
    return app.me;
  }
  async function loadAll(){ await loadMe(); await loadGuildList(); await loadTab(app.tab); render(); }
  async function loadGuildList(){ app.guilds = await apiJson('/api/guild/list?limit=50'); }
  async function loadTab(tab){
    const me = app.me || await loadMe();
    const gid = me?.guild?.id;
    const pid = me?.player?.id || await currentPlayerId();
    if (!gid) return;
    if (tab === 'roster' || tab === 'settings') app.roster = await apiJson(`/api/guild/roster?player_id=${pid}&guild_id=${gid}`);
    if (tab === 'contributions') app.contributions = await apiJson(`/api/guild/contributions?player_id=${pid}&guild_id=${gid}`);
    if (tab === 'research') app.research = await apiJson(`/api/guild/research?player_id=${pid}&guild_id=${gid}`);
    if (tab === 'armory') app.armory = await apiJson(`/api/guild/armory?player_id=${pid}&guild_id=${gid}`);
    if (tab === 'treasury') app.treasury = await apiJson(`/api/guild/treasury?player_id=${pid}&guild_id=${gid}`);
    if (tab === 'wars') app.wars = await apiJson(`/api/guild/wars?player_id=${pid}&guild_id=${gid}`);
    if (tab === 'logs') app.logs = await apiJson(`/api/guild/logs?player_id=${pid}&guild_id=${gid}`);
  }
  async function post(url, body){ const data = await apiJson(url, { method: 'POST', body: JSON.stringify(body) }); await loadAll(); return data; }

  function progressPct(g){
    const xp = Number(g?.xp || 0), next = Number(g?.next_level_xp || 1);
    return Math.max(0, Math.min(100, Math.round((xp / Math.max(1,next)) * 100)));
  }
  function tabButton(id, label){ return `<button type="button" class="${app.tab===id?'active':''}" data-guild-tab="${id}">${label}</button>`; }

  function renderNoGuild(){
    const guilds = app.guilds?.guilds || [];
    return `
      <div class="nova-guild-grid two">
        <form class="nova-guild-card" data-guild-create>
          <h3>Create Guild</h3>
          <p class="muted">Requires money and being docked at a planet. HQ becomes your current planet.</p>
          <label>Name<input name="name" maxlength="64" required /></label>
          <label>Tag<input name="tag" maxlength="8" required /></label>
          <label>Description<textarea name="description" maxlength="500"></textarea></label>
          <label>Status<select name="status"><option value="public">Public</option><option value="invite">Invite Only</option><option value="private">Private</option></select></label>
          <button type="submit">Create Guild</button>
        </form>
        <div class="nova-guild-card">
          <h3>Join Guild</h3>
          <div class="nova-guild-list compact">
            ${guilds.map(g => `<div class="row"><b>[${esc(g.tag)}] ${esc(g.name)}</b><span>Lvl ${esc(g.level)} · ${esc(g.member_count)}/${esc(g.max_members)}</span><button type="button" data-apply-guild="${g.id}">Apply</button></div>`).join('') || '<p class="muted">No guilds yet.</p>'}
          </div>
        </div>
      </div>
      ${renderInvites()}`;
  }
  function renderInvites(){
    const invites = app.me?.invites || [];
    if (!invites.length) return '';
    return `<div class="nova-guild-card"><h3>Invites</h3>${invites.map(i => `<div class="row"><b>[${esc(i.guild_tag)}] ${esc(i.guild_name)}</b><button data-invite-accept="${i.id}">Accept</button><button data-invite-decline="${i.id}">Decline</button></div>`).join('')}</div>`;
  }
  function renderOverview(){
    const g = app.me?.guild;
    const bonuses = g?.research_bonuses || {};
    return `<div class="nova-guild-grid two">
      <div class="nova-guild-card hero"><h2>[${esc(g.tag)}] ${esc(g.name)}</h2><p>${esc(g.description || 'No description set.')}</p><div class="nova-guild-xp"><span style="width:${progressPct(g)}%"></span></div><div class="statline"><b>Level ${esc(g.level)}</b><span>${esc(g.xp)} / ${esc(g.next_level_xp)} XP</span><span>${esc(g.member_count)} / ${esc(g.max_members)} members</span><span>Treasury ${esc(g.treasury)}</span></div><p class="motd">${esc(g.motd || 'No guild message set.')}</p></div>
      <div class="nova-guild-card"><h3>Research Bonuses</h3><div class="chips">${Object.keys(bonuses).map(k => `<span>${esc(k)} +${esc(bonuses[k])}%</span>`).join('') || '<em>No bonuses yet.</em>'}</div></div>
      <div class="nova-guild-card"><h3>Quick Actions</h3><form data-treasury-deposit><label>Deposit Money<input name="amount" type="number" min="1" /></label><button>Deposit</button></form><form data-contribution-record><label>Manual Contribution XP<input name="xp" type="number" min="1" /></label><select name="contribution_type"><option>mission</option><option>material</option><option>combat</option><option>crafting</option><option>war</option></select><button>Record</button></form></div>
      <div class="nova-guild-card"><h3>Guild Loop</h3><ol><li>Gather, fight, craft, mission.</li><li>Contribute XP daily.</li><li>Level guild for capacity and research.</li><li>Use treasury/armory for wars and planet control.</li></ol></div>
    </div>`;
  }
  function renderRoster(){
    const rows = app.roster?.members || [];
    const ranks = app.roster?.ranks || [];
    return `<div class="nova-guild-card"><h3>Roster</h3><table><thead><tr><th>Pilot</th><th>Rank</th><th>Contribution</th><th>Actions</th></tr></thead><tbody>${rows.map(m => `<tr><td>${esc(m.username)}</td><td>${esc(m.rank_name)}</td><td>${esc(m.contribution_total)}</td><td><select data-rank-player="${m.player_id}">${ranks.map(r => `<option value="${r.id}" ${String(r.id)===String(m.rank_id)?'selected':''}>${esc(r.name)}</option>`).join('')}</select><button data-kick-player="${m.player_id}">Kick</button></td></tr>`).join('')}</tbody></table></div>`;
  }
  function renderContributions(){
    const daily = app.contributions?.daily || [];
    const events = app.contributions?.events || [];
    return `<div class="nova-guild-grid two"><div class="nova-guild-card"><h3>Daily Contributions</h3><table><thead><tr><th>Day</th><th>Player</th><th>Raw</th><th>Effective</th></tr></thead><tbody>${daily.map(r => `<tr><td>${esc(r.day)}</td><td>${esc(r.player_id)}</td><td>${esc(r.raw_xp)}</td><td>${esc(r.effective_xp)}</td></tr>`).join('')}</tbody></table></div><div class="nova-guild-card"><h3>Recent Events</h3>${events.map(e => `<div class="log"><b>${esc(e.contribution_type)}</b> +${esc(e.effective_xp)} XP <small>${esc(e.created_at)}</small></div>`).join('') || '<p class="muted">No contributions yet.</p>'}</div></div>`;
  }
  function renderResearch(){
    const defs = app.research?.definitions || [];
    const byCat = defs.reduce((a,d)=>{(a[d.category] ||= []).push(d); return a;},{});
    return `<div class="nova-guild-card"><h3>Research <span>${esc(app.research?.guild?.research_points || 0)} points</span></h3>${Object.entries(byCat).map(([cat,items]) => `<h4>${esc(cat)}</h4><div class="nova-research-grid">${items.map(d => `<div class="research"><b>${esc(d.name)}</b><p>${esc(d.description)}</p><span>Rank ${esc(d.current_rank)} / ${esc(d.max_rank)} · Req Lvl ${esc(d.required_guild_level)}</span><button data-unlock-research="${esc(d.research_key)}">Unlock</button></div>`).join('')}</div>`).join('')}</div>`;
  }
  function renderArmory(){
    const items = app.armory?.items || [];
    return `<div class="nova-guild-grid two"><form class="nova-guild-card" data-armory-deposit><h3>Deposit Current Planet Item</h3><label>Type<input name="item_type" value="material" /></label><label>Key<input name="item_key" required /></label><label>Name<input name="item_name" /></label><label>Quantity<input name="quantity" type="number" min="1" value="1" /></label><button>Deposit</button><p class="muted">Inventory is planet-specific. If the adapter cannot find your inventory table, it blocks the action instead of duplicating items.</p></form><div class="nova-guild-card"><h3>Planet Armory ${esc(app.armory?.planet_id || '')}</h3><table><thead><tr><th>Item</th><th>Qty</th><th></th></tr></thead><tbody>${items.map(i => `<tr><td>${esc(i.item_name || i.item_key)}<small>${esc(i.item_type)}</small></td><td>${esc(i.quantity)}</td><td><button data-withdraw-key="${esc(i.item_key)}" data-withdraw-type="${esc(i.item_type)}">Withdraw 1</button></td></tr>`).join('')}</tbody></table></div></div>`;
  }
  function renderTreasury(){
    const logs = app.treasury?.logs || [];
    return `<div class="nova-guild-grid two"><form class="nova-guild-card" data-treasury-deposit><h3>Treasury</h3><p class="big">${esc(app.treasury?.treasury || 0)}</p><label>Deposit<input name="amount" type="number" min="1" /></label><button>Deposit</button></form><div class="nova-guild-card"><h3>Transactions</h3>${logs.map(l => `<div class="log"><b>${esc(l.reason)}</b> ${esc(l.amount)} → ${esc(l.balance_after)} <small>${esc(l.created_at)}</small></div>`).join('')}</div></div>`;
  }
  function renderWars(){
    const wars = app.wars?.wars || [];
    return `<div class="nova-guild-grid two"><form class="nova-guild-card" data-war-declare><h3>Declare War</h3><label>Type<select name="target_type"><option value="guild">Guild</option><option value="planet">Planet</option></select></label><label>Target Guild ID<input name="target_guild_id" type="number" /></label><label>Target Planet ID<input name="target_planet_id" type="number" /></label><label>Reason<textarea name="reason"></textarea></label><button>Declare</button></form><div class="nova-guild-card"><h3>Wars</h3>${wars.map(w => `<div class="war"><b>${esc(w.target_type)} war #${esc(w.id)}</b><span>${esc(w.status)} · Cost ${esc(w.declaration_cost)}</span><small>${esc(w.starts_at)} → ${esc(w.ends_at)}</small></div>`).join('') || '<p class="muted">No wars.</p>'}</div></div>`;
  }
  function renderApps(){
    return `<div class="nova-guild-card"><h3>Applications / Invites</h3><form data-guild-invite><label>Recipient Player ID<input name="recipient_id" type="number" /></label><label>Recipient Name<input name="recipient_name" /></label><button>Send Invite</button></form>${renderInvites()}</div>`;
  }
  function renderSettings(){
    return `<div class="nova-guild-card"><h3>Settings</h3><p class="muted">Rank permissions are server-side and data-driven. This first pass exposes rank assignment; full custom-rank editing is table-ready.</p>${renderRoster()}</div>`;
  }
  function renderLogs(){
    const logs = app.logs?.logs || [];
    return `<div class="nova-guild-card"><h3>Guild Logs</h3>${logs.map(l => `<div class="log"><b>${esc(l.action)}</b> actor ${esc(l.actor_player_id || '')} target ${esc(l.target_player_id || '')}<small>${esc(l.created_at)}</small></div>`).join('') || '<p class="muted">No logs.</p>'}</div>`;
  }

  function render(){
    const root = ensureRoot();
    if (!app.open) { root.hidden = true; return; }
    root.hidden = false;
    const me = app.me;
    const g = me?.guild;
    root.innerHTML = `<div class="nova-guild-shell"><header><div><strong>Guild Command</strong><span>${g ? `[${esc(g.tag)}] ${esc(g.name)}` : 'No guild'}</span></div><button type="button" data-guild-close>×</button></header>${app.err ? `<div class="nova-guild-error">${esc(app.err)}</div>` : ''}<nav>${g ? [tabButton('overview','Overview'),tabButton('roster','Roster'),tabButton('contributions','Contributions'),tabButton('armory','Armory'),tabButton('research','Research'),tabButton('treasury','Treasury'),tabButton('wars','Wars'),tabButton('apps','Apps/Invites'),tabButton('settings','Settings'),tabButton('logs','Logs')].join('') : ''}</nav><main>${!me ? '<div class="nova-guild-card">Loading guild data...</div>' : !g ? renderNoGuild() : app.tab==='overview' ? renderOverview() : app.tab==='roster' ? renderRoster() : app.tab==='contributions' ? renderContributions() : app.tab==='armory' ? renderArmory() : app.tab==='research' ? renderResearch() : app.tab==='treasury' ? renderTreasury() : app.tab==='wars' ? renderWars() : app.tab==='apps' ? renderApps() : app.tab==='settings' ? renderSettings() : renderLogs()}</main></div>`;
    bind();
  }

  function formData(form){ return Object.fromEntries(new FormData(form).entries()); }
  function bind(){
    qs('[data-guild-close]')?.addEventListener('click', closeGuildPage);
    qsa('[data-guild-tab]').forEach(b => b.addEventListener('click', () => setTab(b.getAttribute('data-guild-tab'))));
    qs('[data-guild-create]')?.addEventListener('submit', async e => { e.preventDefault(); const pid = await currentPlayerId(); await post('/api/guild/create', { player_id: pid, ...formData(e.currentTarget) }).catch(showError); });
    qsa('[data-apply-guild]').forEach(b => b.addEventListener('click', async () => { const pid = await currentPlayerId(); await post('/api/guild/apply', { player_id: pid, guild_id: Number(b.dataset.applyGuild) }).catch(showError); }));
    qsa('[data-invite-accept]').forEach(b => b.addEventListener('click', async () => { const pid = await currentPlayerId(); await post('/api/guild/invite/respond', { player_id: pid, invite_id: Number(b.dataset.inviteAccept), accept: true }).catch(showError); }));
    qsa('[data-invite-decline]').forEach(b => b.addEventListener('click', async () => { const pid = await currentPlayerId(); await post('/api/guild/invite/respond', { player_id: pid, invite_id: Number(b.dataset.inviteDecline), accept: false }).catch(showError); }));
    qs('[data-treasury-deposit]')?.addEventListener('submit', async e => { e.preventDefault(); const pid = await currentPlayerId(); await post('/api/guild/treasury/deposit', { player_id: pid, guild_id: app.me.guild.id, amount: Number(formData(e.currentTarget).amount || 0) }).catch(showError); });
    qs('[data-contribution-record]')?.addEventListener('submit', async e => { e.preventDefault(); const pid = await currentPlayerId(); const d = formData(e.currentTarget); await post('/api/guild/contributions/record', { player_id: pid, contribution_type: d.contribution_type, xp: Number(d.xp || 0), source: 'guild_ui_manual' }).catch(showError); });
    qsa('[data-unlock-research]').forEach(b => b.addEventListener('click', async () => { const pid = await currentPlayerId(); await post('/api/guild/research/unlock', { player_id: pid, guild_id: app.me.guild.id, research_key: b.dataset.unlockResearch }).catch(showError); }));
    qs('[data-armory-deposit]')?.addEventListener('submit', async e => { e.preventDefault(); const pid = await currentPlayerId(); const d = formData(e.currentTarget); await post('/api/guild/armory/deposit', { player_id: pid, guild_id: app.me.guild.id, ...d, quantity: Number(d.quantity || 1) }).catch(showError); });
    qsa('[data-withdraw-key]').forEach(b => b.addEventListener('click', async () => { const pid = await currentPlayerId(); await post('/api/guild/armory/withdraw', { player_id: pid, guild_id: app.me.guild.id, item_key: b.dataset.withdrawKey, item_type: b.dataset.withdrawType, quantity: 1 }).catch(showError); }));
    qs('[data-war-declare]')?.addEventListener('submit', async e => { e.preventDefault(); const pid = await currentPlayerId(); const d = formData(e.currentTarget); await post('/api/guild/war/declare', { player_id: pid, guild_id: app.me.guild.id, target_type: d.target_type, target_guild_id: d.target_guild_id ? Number(d.target_guild_id) : null, target_planet_id: d.target_planet_id ? Number(d.target_planet_id) : null, reason: d.reason || '' }).catch(showError); });
    qs('[data-guild-invite]')?.addEventListener('submit', async e => { e.preventDefault(); const pid = await currentPlayerId(); const d = formData(e.currentTarget); await post('/api/guild/invite', { player_id: pid, guild_id: app.me.guild.id, recipient_id: d.recipient_id ? Number(d.recipient_id) : null, recipient_name: d.recipient_name || null }).catch(showError); });
    qsa('[data-kick-player]').forEach(b => b.addEventListener('click', async () => { const pid = await currentPlayerId(); await post('/api/guild/kick', { player_id: pid, guild_id: app.me.guild.id, target_player_id: Number(b.dataset.kickPlayer) }).catch(showError); }));
    qsa('[data-rank-player]').forEach(s => s.addEventListener('change', async () => { const pid = await currentPlayerId(); await post('/api/guild/rank/update', { player_id: pid, guild_id: app.me.guild.id, target_player_id: Number(s.dataset.rankPlayer), rank_id: Number(s.value) }).catch(showError); }));
  }

  function routeCheck(){ if (String(location.hash || '').replace('#','').toLowerCase() === 'guild') openGuildPage(); else if (app.open) closeGuildPage(); }
  function boot(){ ensureNav(); routeCheck(); setInterval(ensureNav, 3000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.addEventListener('hashchange', routeCheck);
})();
"""
    text = text.rstrip() + block + '\n'
    write_if_changed(FRONTEND, original, text, 'frontend/src/main.jsx')


def patch_css() -> None:
    old = CSS.read_text(encoding='utf-8') if CSS.exists() else ''
    if CSS_MARKER in old:
        skipped.append('frontend/src/styles.css: guild css marker already present')
        return
    block = r"""

/* NOVA_GUILD_SYSTEM_CSS_V1 */
.nova-guild-nav-btn{border:1px solid rgba(130,180,255,.35);background:rgba(28,42,72,.75);color:#eaf2ff;border-radius:999px;padding:.55rem .9rem;margin:.2rem;cursor:pointer;font-weight:800;letter-spacing:.04em}
.nova-guild-root{position:fixed;inset:0;z-index:99970;background:rgba(3,7,14,.76);backdrop-filter:blur(10px);overflow:auto;padding:24px;color:#eaf2ff}
.nova-guild-shell{max-width:1280px;margin:0 auto;border:1px solid rgba(120,170,255,.22);border-radius:24px;background:linear-gradient(145deg,rgba(9,16,31,.98),rgba(18,28,50,.94));box-shadow:0 24px 80px rgba(0,0,0,.48);overflow:hidden}
.nova-guild-shell>header{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid rgba(140,180,255,.16);background:rgba(8,13,24,.82)}
.nova-guild-shell>header strong{display:block;font-size:1.25rem;letter-spacing:.08em;text-transform:uppercase}.nova-guild-shell>header span{display:block;color:#9fb4d6;margin-top:3px}.nova-guild-shell>header button{border:0;background:rgba(255,255,255,.08);color:#fff;border-radius:14px;font-size:1.6rem;width:42px;height:42px;cursor:pointer}
.nova-guild-shell>nav{display:flex;gap:8px;overflow:auto;padding:12px 16px;background:rgba(11,20,38,.7);border-bottom:1px solid rgba(140,180,255,.12)}
.nova-guild-shell>nav button{white-space:nowrap;border:1px solid rgba(130,170,230,.22);background:rgba(255,255,255,.05);color:#c9d7ef;border-radius:999px;padding:.55rem .85rem;cursor:pointer;font-weight:700}.nova-guild-shell>nav button.active{background:linear-gradient(135deg,#3d7cff,#6ee7ff);color:#06101f;border-color:transparent}
.nova-guild-shell main{padding:18px}.nova-guild-grid{display:grid;gap:16px}.nova-guild-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}.nova-guild-card{border:1px solid rgba(130,170,230,.18);border-radius:18px;background:rgba(8,15,29,.78);padding:18px;box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}
.nova-guild-card h2,.nova-guild-card h3,.nova-guild-card h4{margin:0 0 12px}.nova-guild-card p{color:#b7c6df}.nova-guild-card.hero h2{font-size:1.8rem}.nova-guild-card label{display:block;margin:10px 0;color:#b9c9e5;font-weight:700}.nova-guild-card input,.nova-guild-card textarea,.nova-guild-card select{width:100%;box-sizing:border-box;margin-top:6px;border:1px solid rgba(150,190,255,.22);background:rgba(3,8,18,.72);color:#eef5ff;border-radius:12px;padding:.7rem}.nova-guild-card textarea{min-height:88px;resize:vertical}.nova-guild-card button{border:0;background:linear-gradient(135deg,#4b87ff,#6ee7ff);color:#06101f;border-radius:12px;padding:.65rem .9rem;cursor:pointer;font-weight:900}.nova-guild-card button+button{margin-left:6px}.nova-guild-error{margin:14px 18px 0;padding:12px 14px;border-radius:14px;background:rgba(255,75,95,.14);border:1px solid rgba(255,95,115,.35);color:#ffd7de}
.nova-guild-xp{height:13px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;margin:14px 0}.nova-guild-xp span{display:block;height:100%;background:linear-gradient(90deg,#5f92ff,#62f0ff)}.statline{display:flex;gap:12px;flex-wrap:wrap;color:#b8c9e4}.motd{border-left:3px solid rgba(98,240,255,.7);padding-left:12px}.chips{display:flex;gap:8px;flex-wrap:wrap}.chips span{border:1px solid rgba(130,190,255,.24);border-radius:999px;padding:.45rem .7rem;background:rgba(255,255,255,.06);color:#dcecff}.nova-guild-list.compact .row,.nova-guild-card .row{display:flex;align-items:center;gap:12px;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.07);padding:10px 0}.nova-guild-card table{width:100%;border-collapse:collapse}.nova-guild-card th,.nova-guild-card td{border-bottom:1px solid rgba(255,255,255,.08);text-align:left;padding:10px;vertical-align:middle}.nova-guild-card th{color:#9eb8df;text-transform:uppercase;font-size:.78rem;letter-spacing:.08em}.nova-guild-card small{display:block;color:#8298bb;margin-top:3px}.nova-research-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:10px 0 18px}.research,.war,.log{border:1px solid rgba(130,170,230,.16);border-radius:14px;background:rgba(255,255,255,.045);padding:12px;margin:8px 0}.research p{min-height:42px}.war span,.war small,.log small{display:block;color:#92a6c8;margin-top:4px}.big{font-size:2.2rem;color:#fff!important;font-weight:900}.muted{color:#91a2bf!important}
@media (max-width:900px){.nova-guild-root{padding:8px}.nova-guild-grid.two,.nova-research-grid{grid-template-columns:1fr}.nova-guild-shell main{padding:10px}.nova-guild-card{padding:13px}.nova-guild-card table{font-size:.85rem}}
"""
    write_if_changed(CSS, old, old.rstrip() + block + '\n', 'frontend/src/styles.css')


def write_docs() -> None:
    doc = f'''# NOVA_GUILD_SYSTEM_NOTES_V1

# Nova Frontiers Guild System Rewrite Foundation

This patch adds a normalized guild foundation built around this loop:

players gather/fight/craft/mission -> guild contribution XP -> guild levels -> research points/member cap -> armory/treasury support -> guild/planet wars.

## Implemented tables

- guild_settings
- guilds
- guild_ranks
- guild_members
- guild_applications
- guild_invites
- guild_contributions_daily
- guild_contribution_events
- guild_research_definitions
- guild_research
- guild_armory
- guild_treasury_log
- guild_wars
- guild_war_scores
- guild_planet_influence
- guild_logs

## Implemented endpoints

- GET /api/guild/me
- GET /api/guild/list
- GET /api/guild/detail
- GET /api/guild/roster
- POST /api/guild/create
- POST /api/guild/apply
- POST /api/guild/invite
- POST /api/guild/invite/respond
- POST /api/guild/leave
- POST /api/guild/kick
- POST /api/guild/rank/update
- GET /api/guild/contributions
- POST /api/guild/contributions/record
- GET /api/guild/research
- POST /api/guild/research/unlock
- GET /api/guild/armory
- POST /api/guild/armory/deposit
- POST /api/guild/armory/withdraw
- GET /api/guild/treasury
- POST /api/guild/treasury/deposit
- POST /api/guild/war/declare
- POST /api/guild/war/surrender
- GET /api/guild/wars
- GET /api/guild/logs
- GET /api/admin/guild/settings
- POST /api/admin/guild/settings

## Balance defaults

- Guild creation cost: 25,000 money.
- Starting size: 10.
- Level cap: 5.
- Max size at level 5: 50.
- Daily contribution soft cap: 2,500 guild XP per player.
- Over-cap contribution value: 20%.
- New member armory withdrawal lock: 24 hours.
- Guild war base cost: 50,000.
- Planet war base cost: 150,000.
- Guild war prep: 30 minutes.
- Guild war duration: 24 hours.
- Planet war duration: 48 hours.
- Same-target war cooldown: 48 hours.

## Critical integration note

The armory is intentionally planet-specific. Deposit/withdraw uses a safe inventory adapter that only modifies inventory if it detects a compatible planet-specific inventory table. If it cannot detect one, it blocks the action instead of creating a duplication exploit.

If your project inventory table has a custom name/shape, wire it into `_nova_guild_inventory_change` inside `backend/app/main.py`.

## Contribution hook

The reusable backend function is:

```python
nova_record_guild_contribution(conn, player_id, contribution_type, raw_xp, quantity, source, metadata)
```

Call it after existing mining, processing, crafting, mission, combat, salvage, delivery, event, and war actions. This avoids polluting `/api/state` and keeps guild progression event-driven.

## MMO performance choices

- Guild data does not get appended into every `/api/state` response.
- Guild page fetches only when opened.
- Logs are paginated/capped.
- Contributions use daily aggregate rows plus compact event rows.
- Armory, treasury, war declaration, and research unlock paths use immediate SQLite transactions.

## Known first-pass boundary

This patch creates war declarations, scores, timers, and costs. It does not yet hook every PvP/objective/combat kill into `guild_war_scores`; wire those scoring updates into existing combat resolution after confirming your exact battle helper names.
'''
    old = DOC.read_text(encoding='utf-8') if DOC.exists() else None
    write_if_changed(DOC, old, doc, 'NOVA_GUILD_SYSTEM_NOTES.md')

    tests = f'''# NOVA_GUILD_SYSTEM_TEST_CHECKLIST_V1

Run this after applying the patch.

## Backend compile

```bash
python -m py_compile backend/app/main.py
```

## Frontend build

```bash
cd frontend
npm run build
```

## Guild creation

- Dock a player at a planet.
- Give the player enough money.
- Open Guild page.
- Create guild.
- Confirm money is deducted.
- Confirm guild HQ/home planet equals current planet.
- Confirm leader rank exists.
- Confirm max members is 10.

## Join / invite / apply

- Use a second player.
- Apply to guild.
- Send invite from leader/officer.
- Accept invite.
- Confirm one guild per player.
- Confirm full guild blocks joins.

## Ranks / permissions

- Promote/demote lower ranks.
- Try to kick same/higher rank; should fail.
- Try officer/recruit destructive actions; unauthorized should fail.
- Confirm recruit cannot withdraw armory by default.

## Contributions

- POST /api/guild/contributions/record with mining/material/combat/mission/crafting/war types.
- Confirm daily aggregate updates.
- Confirm guild XP increases.
- Confirm over soft cap uses reduced XP.
- Confirm guild levels at configured thresholds.
- Confirm research points are granted on level-up.

## Research

- Unlock research with leader/officer.
- Confirm points decrease.
- Confirm rank increases.
- Confirm max rank blocks further purchase.
- Confirm level requirement blocks too-early research.

## Armory

- Deposit item at planet.
- Confirm current planet required.
- Confirm incompatible inventory adapter blocks instead of duping.
- Confirm item stays tied to planet_id.
- Withdraw item as recruit; should fail.
- Withdraw item as leader/officer/veteran if allowed.
- Confirm withdrawal cannot exceed quantity.
- Confirm locked/new-member rule works.

## Treasury

- Deposit money.
- Confirm player money decreases.
- Confirm treasury increases.
- Confirm treasury log row is created.
- Confirm money contribution XP is recorded.

## Wars

- Declare guild war.
- Confirm treasury cost is deducted.
- Confirm prep/start/end timestamps exist.
- Confirm same-target cooldown blocks repeated declaration.
- Declare planet war.
- Confirm higher planet war base cost.
- Surrender war with authorized member.
- Confirm unauthorized surrender fails.

## Logs

- Confirm logs for create, join, invite, rank update, treasury deposit, armory deposit/withdraw, research unlock, war declare.

## Race / duplicate attempts

- Double-click treasury deposit.
- Double-click armory withdrawal.
- Try negative quantities.
- Try withdraw more than exists.
- Try direct endpoint calls as non-member.
- Try client-side rank spoofing.
'''
    old_tests = TESTS.read_text(encoding='utf-8') if TESTS.exists() else None
    write_if_changed(TESTS, old_tests, tests, 'NOVA_GUILD_SYSTEM_TEST_CHECKLIST.md')


def main() -> None:
    patch_backend()
    patch_frontend()
    patch_css()
    write_docs()
    print('Nova Guild System Rewrite Foundation patch complete.')
    if changed:
        print('\nChanged:')
        for c in changed:
            print(' - ' + c)
    if skipped:
        print('\nSkipped:')
        for s in skipped:
            print(' - ' + s)


if __name__ == '__main__':
    main()
