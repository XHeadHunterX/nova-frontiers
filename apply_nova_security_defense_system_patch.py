from __future__ import annotations

import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

STAMP = datetime.now().strftime('%Y%m%d-%H%M%S')
ROOT = Path.cwd()
BACKEND = ROOT / 'backend' / 'app' / 'main.py'
FRONTEND = ROOT / 'frontend' / 'src' / 'main.jsx'
CSS = ROOT / 'frontend' / 'src' / 'styles.css'
DOC = ROOT / 'NOVA_SECURITY_DEFENSE_SYSTEM_NOTES.md'

MARKER_BACKEND = 'NOVA_SECURITY_DEFENSE_SYSTEM_V1'
MARKER_BUILD_STATE = 'NOVA_SECURITY_DEFENSE_STATE_TICK_CALL_V1'
MARKER_FRONTEND = 'NOVA_SECURITY_DEFENSE_FRONTEND_OVERLAY_V1'
MARKER_CSS = 'NOVA_SECURITY_DEFENSE_CSS_V1'
MARKER_DOC = 'NOVA_SECURITY_DEFENSE_SYSTEM_NOTES_V1'

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
        skipped.append(f'{label}: already current or no matching insertion point')
        return
    backup(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(new, encoding='utf-8', newline='')
    changed.append(label)


def patch_backend() -> None:
    text = read_text(BACKEND)
    original = text

    helper_block = r"""

# NOVA_SECURITY_DEFENSE_SYSTEM_V1
# Security-band gate turrets + patrol scaling system.
# Model:
# - home galaxies trend to 1.0 security
# - dead-center/contested/null center trends to 0.0 security
# - gate turrets exist in safer space, are stationary, and respawn after admin-configured delay
# - if all turrets in a galaxy are wiped, turret count multiplier doubles until quiet for 1 hour
# - patrols scale by security, but increase gradually after repeated galaxy losses instead of hard-ganking players
# - active war galaxies stop spawning new turrets/patrols; current defenders remain until defeated
import math as _nova_sec_math
import random as _nova_sec_random
import sqlite3 as _nova_sec_sqlite3
import time as _nova_sec_time
from datetime import datetime as _NovaSecDatetime, timezone as _NovaSecTimezone
try:
    from fastapi import HTTPException as _NovaSecHTTPException
except Exception:  # pragma: no cover
    _NovaSecHTTPException = Exception
try:
    from pydantic import BaseModel as _NovaSecBaseModel
except Exception:  # pragma: no cover
    _NovaSecBaseModel = object


class NovaSecuritySettingsRequest(_NovaSecBaseModel):
    turret_respawn_seconds: int | None = None
    turret_escalation_quiet_seconds: int | None = None
    turret_range_multiplier: float | None = None
    max_turret_multiplier: int | None = None
    patrol_respawn_seconds: int | None = None
    patrol_escalation_quiet_seconds: int | None = None
    max_patrol_bonus: int | None = None
    set_war_galaxy_id: str | None = None
    set_war_active: bool | None = None


def _nova_sec_now_iso() -> str:
    return _NovaSecDatetime.now(_NovaSecTimezone.utc).isoformat()


def _nova_sec_raise(status_code: int, detail: str):
    try:
        raise _NovaSecHTTPException(status_code=status_code, detail=detail)
    except TypeError:
        raise _NovaSecHTTPException(detail)


def _nova_sec_rows(conn, sql: str, params: tuple = ()) -> list[dict]:
    cur = conn.execute(sql, params)
    out = []
    for r in cur.fetchall():
        try:
            out.append(dict(r))
        except Exception:
            cols = [d[0] for d in cur.description or []]
            out.append({cols[i]: r[i] for i in range(min(len(cols), len(r)))})
    return out


def _nova_sec_row(conn, sql: str, params: tuple = ()) -> dict | None:
    rows = _nova_sec_rows(conn, sql, params)
    return rows[0] if rows else None


def _nova_sec_table_exists(conn, table: str) -> bool:
    try:
        return bool(_nova_sec_row(conn, 'SELECT 1 FROM sqlite_master WHERE type="table" AND name=? LIMIT 1', (table,)))
    except Exception:
        return False


def _nova_sec_cols(conn, table: str) -> set[str]:
    try:
        return {str(r.get('name')) for r in _nova_sec_rows(conn, f'PRAGMA table_info({table})')}
    except Exception:
        return set()


def _nova_sec_first_col(cols: set[str], choices: tuple[str, ...]) -> str | None:
    for c in choices:
        if c in cols:
            return c
    return None


def _nova_sec_num(v, default=0.0) -> float:
    try:
        if v is None or v == '':
            return float(default)
        return float(v)
    except Exception:
        return float(default)


def _nova_sec_int(v, default=0) -> int:
    try:
        if v is None or v == '':
            return int(default)
        return int(float(v))
    except Exception:
        return int(default)


def nova_security_ensure_tables(conn) -> None:
    conn.execute('''
        CREATE TABLE IF NOT EXISTS security_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    ''')
    defaults = {
        'turret_respawn_seconds': '600',
        'turret_escalation_quiet_seconds': '3600',
        'turret_range_multiplier': '3',
        'max_turret_multiplier': '8',
        'patrol_respawn_seconds': '420',
        'patrol_escalation_quiet_seconds': '3600',
        'max_patrol_bonus': '6',
        'turret_base_range': '520',
        'patrol_threat_range': '360',
        'security_tick_seconds': '8',
    }
    now = _nova_sec_now_iso()
    for k, v in defaults.items():
        conn.execute('INSERT OR IGNORE INTO security_settings(key,value,updated_at) VALUES(?,?,?)', (k, v, now))

    conn.execute('''
        CREATE TABLE IF NOT EXISTS galaxy_security_state (
            galaxy_id TEXT PRIMARY KEY,
            security_level REAL NOT NULL DEFAULT 0.5,
            owner_faction TEXT NOT NULL DEFAULT 'contested',
            war_active INTEGER NOT NULL DEFAULT 0,
            turret_multiplier INTEGER NOT NULL DEFAULT 1,
            turret_last_loss_ts REAL NOT NULL DEFAULT 0,
            turret_wipe_count INTEGER NOT NULL DEFAULT 0,
            patrol_bonus INTEGER NOT NULL DEFAULT 0,
            patrol_last_loss_ts REAL NOT NULL DEFAULT 0,
            last_tick_ts REAL NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS security_defense_registry (
            npc_id TEXT PRIMARY KEY,
            galaxy_id TEXT NOT NULL,
            defense_type TEXT NOT NULL,
            gate_id TEXT,
            faction_id TEXT NOT NULL,
            base_slot INTEGER NOT NULL DEFAULT 0,
            spawned_at REAL NOT NULL,
            respawn_after REAL NOT NULL DEFAULT 0,
            last_seen_alive REAL NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'active'
        )
    ''')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_security_defense_registry_galaxy_type ON security_defense_registry(galaxy_id, defense_type, status)')

    conn.execute('''
        CREATE TABLE IF NOT EXISTS security_auto_engagements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            galaxy_id TEXT NOT NULL,
            defender_npc_id TEXT NOT NULL,
            target_player_id TEXT NOT NULL,
            reason TEXT NOT NULL,
            created_ts REAL NOT NULL,
            created_at TEXT NOT NULL,
            resolved INTEGER NOT NULL DEFAULT 0
        )
    ''')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_security_auto_engagements_target ON security_auto_engagements(target_player_id, resolved, created_ts)')

    # Keep this table compatible with the existing traffic builder. Older builds crashed when npcs was missing.
    conn.execute('''
        CREATE TABLE IF NOT EXISTS npcs (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'patrol',
            level INTEGER NOT NULL DEFAULT 1,
            avatar TEXT NOT NULL DEFAULT '◌',
            guild_tag TEXT NOT NULL DEFAULT '',
            faction_id TEXT NOT NULL DEFAULT 'contested',
            x INTEGER NOT NULL DEFAULT 5000,
            y INTEGER NOT NULL DEFAULT 5000,
            location_id TEXT,
            galaxy_id TEXT NOT NULL DEFAULT 'unknown',
            traveling INTEGER NOT NULL DEFAULT 0,
            origin_x INTEGER,
            origin_y INTEGER,
            destination_x INTEGER,
            destination_y INTEGER,
            destination_id TEXT,
            start_time REAL,
            arrival_time REAL,
            stance TEXT NOT NULL DEFAULT 'lawful',
            counter_scan_id TEXT NOT NULL DEFAULT 'none',
            equipment_summary TEXT NOT NULL DEFAULT '',
            hp INTEGER NOT NULL DEFAULT 100,
            max_hp INTEGER NOT NULL DEFAULT 100,
            active INTEGER NOT NULL DEFAULT 1,
            updated_at TEXT
        )
    ''')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_npcs_galaxy_active ON npcs(galaxy_id, active)')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_npcs_role_galaxy ON npcs(role, galaxy_id)')


def _nova_sec_setting_map(conn) -> dict[str, str]:
    nova_security_ensure_tables(conn)
    return {str(r.get('key')): str(r.get('value')) for r in _nova_sec_rows(conn, 'SELECT key,value FROM security_settings')}


def _nova_sec_setting(conn, key: str, default):
    return _nova_sec_setting_map(conn).get(key, str(default))


def _nova_sec_get_galaxies(conn) -> list[dict]:
    galaxies: dict[str, dict] = {}
    if _nova_sec_table_exists(conn, 'galaxies'):
        cols = _nova_sec_cols(conn, 'galaxies')
        id_col = _nova_sec_first_col(cols, ('id', 'galaxy_id', 'code', 'slug'))
        name_col = _nova_sec_first_col(cols, ('name', 'label', 'title'))
        x_col = _nova_sec_first_col(cols, ('x', 'x_pct', 'map_x', 'pos_x'))
        y_col = _nova_sec_first_col(cols, ('y', 'y_pct', 'map_y', 'pos_y'))
        faction_col = _nova_sec_first_col(cols, ('faction_id', 'owner_faction', 'controlling_faction', 'faction'))
        if id_col:
            parts = [f'{id_col} AS galaxy_id']
            if name_col: parts.append(f'{name_col} AS name')
            if x_col: parts.append(f'{x_col} AS x')
            if y_col: parts.append(f'{y_col} AS y')
            if faction_col: parts.append(f'{faction_col} AS faction_id')
            try:
                for row in _nova_sec_rows(conn, f"SELECT {', '.join(parts)} FROM galaxies"):
                    gid = str(row.get('galaxy_id') or '').strip()
                    if gid:
                        galaxies[gid] = row
            except Exception:
                pass
    for table in ('planets', 'npcs'):
        if _nova_sec_table_exists(conn, table):
            cols = _nova_sec_cols(conn, table)
            gal_col = _nova_sec_first_col(cols, ('galaxy_id', 'galaxy'))
            faction_col = _nova_sec_first_col(cols, ('faction_id', 'owner_faction', 'controlling_faction', 'faction'))
            if gal_col:
                sql = f'SELECT DISTINCT {gal_col} AS galaxy_id' + (f', {faction_col} AS faction_id' if faction_col else '') + f' FROM {table} WHERE {gal_col} IS NOT NULL'
                try:
                    for row in _nova_sec_rows(conn, sql):
                        gid = str(row.get('galaxy_id') or '').strip()
                        if gid and gid not in galaxies:
                            galaxies[gid] = {'galaxy_id': gid, 'name': gid, 'faction_id': row.get('faction_id') or ''}
                except Exception:
                    pass
    return list(galaxies.values())


def _nova_sec_owner_from_galaxy(galaxy_id: str, row: dict | None = None) -> str:
    raw = str((row or {}).get('faction_id') or '').strip().lower()
    if raw and raw not in {'none', 'null', 'unknown'}:
        return raw
    gid = str(galaxy_id or '').lower()
    for key in ('helios', 'aurelian', 'umbra', 'solari', 'orion', 'vanguard'):
        if key in gid:
            return key
    if 'home' in gid:
        return gid.split('-home')[0].replace('_', '-').strip('-') or 'contested'
    return 'contested'


def _nova_sec_security_from_galaxy(galaxy_id: str, row: dict | None, max_radius: float) -> float:
    gid = str(galaxy_id or '').lower()
    if 'home' in gid or 'safe' in gid or 'capital' in gid:
        return 1.0
    if 'null' in gid or 'dead-center' in gid or 'dead_center' in gid or 'center' in gid or gid in {'core', 'central', 'void'}:
        return 0.0
    x = _nova_sec_num((row or {}).get('x'), None)
    y = _nova_sec_num((row or {}).get('y'), None)
    if x is not None and y is not None and max_radius > 0:
        # Normalize: exact center is 0.0, far rim is 1.0.
        dist = (_nova_sec_math.sqrt((x ** 2) + (y ** 2)) / max_radius)
        return max(0.0, min(1.0, round(dist, 2)))
    if 'border' in gid or 'frontier' in gid or 'war' in gid:
        return 0.35
    if 'low' in gid:
        return 0.25
    return 0.5


def _nova_sec_galaxy_max_radius(galaxies: list[dict]) -> float:
    max_r = 0.0
    for g in galaxies:
        x = _nova_sec_num(g.get('x'), None)
        y = _nova_sec_num(g.get('y'), None)
        if x is not None and y is not None:
            max_r = max(max_r, _nova_sec_math.sqrt((x ** 2) + (y ** 2)))
    return max_r or 1.0


def _nova_sec_sync_galaxy_state(conn) -> None:
    galaxies = _nova_sec_get_galaxies(conn)
    max_radius = _nova_sec_galaxy_max_radius(galaxies)
    now = _nova_sec_now_iso()
    for g in galaxies:
        gid = str(g.get('galaxy_id') or '').strip()
        if not gid:
            continue
        sec = _nova_sec_security_from_galaxy(gid, g, max_radius)
        owner = _nova_sec_owner_from_galaxy(gid, g)
        conn.execute('''
            INSERT INTO galaxy_security_state(galaxy_id, security_level, owner_faction, war_active, updated_at)
            VALUES(?,?,?,?,?)
            ON CONFLICT(galaxy_id) DO UPDATE SET
              security_level=excluded.security_level,
              owner_faction=CASE WHEN galaxy_security_state.owner_faction='' OR galaxy_security_state.owner_faction='contested' THEN excluded.owner_faction ELSE galaxy_security_state.owner_faction END,
              updated_at=excluded.updated_at
        ''', (gid, sec, owner, 0, now))


def _nova_sec_base_turrets(security_level: float) -> int:
    s = max(0.0, min(1.0, float(security_level)))
    if s <= 0.05:
        return 0
    if s >= 0.95:
        return 6
    if s >= 0.75:
        return 5
    if s >= 0.55:
        return 4
    if s >= 0.35:
        return 3
    if s >= 0.15:
        return 2
    return 1


def _nova_sec_base_patrols(security_level: float) -> int:
    s = max(0.0, min(1.0, float(security_level)))
    if s <= 0.05:
        return 0
    # Softer than turrets: enough to signal risk, not enough to grief everyone.
    return max(1, min(5, int(round(1 + s * 4))))


def _nova_sec_gate_rows(conn, galaxy_id: str) -> list[dict]:
    out: list[dict] = []
    if _nova_sec_table_exists(conn, 'planets'):
        cols = _nova_sec_cols(conn, 'planets')
        gal_col = _nova_sec_first_col(cols, ('galaxy_id', 'galaxy'))
        id_col = _nova_sec_first_col(cols, ('id', 'planet_id', 'code', 'slug'))
        name_col = _nova_sec_first_col(cols, ('name', 'label', 'title'))
        x_col = _nova_sec_first_col(cols, ('x', 'x_pct', 'map_x', 'pos_x'))
        y_col = _nova_sec_first_col(cols, ('y', 'y_pct', 'map_y', 'pos_y'))
        if gal_col and id_col:
            parts = [f'{id_col} AS id']
            if name_col: parts.append(f'{name_col} AS name')
            if x_col: parts.append(f'{x_col} AS x')
            if y_col: parts.append(f'{y_col} AS y')
            try:
                rows = _nova_sec_rows(conn, f"SELECT {', '.join(parts)} FROM planets WHERE {gal_col}=?", (galaxy_id,))
                for r in rows:
                    label = (str(r.get('id') or '') + ' ' + str(r.get('name') or '')).lower()
                    if 'gate' in label or 'crossing' in label or 'jump' in label or 'relay' in label:
                        out.append(r)
            except Exception:
                pass
    if not out:
        # Deterministic fallback gates. Keeps system functional even before real gate schema exists.
        points = [(5000, 900), (9100, 5000), (5000, 9100), (900, 5000)]
        for i, (x, y) in enumerate(points, 1):
            out.append({'id': f'{galaxy_id}-auto-gate-{i}', 'name': f'Gate {i}', 'x': x, 'y': y})
    return out[:6]


def _nova_sec_upsert_npc(conn, npc: dict) -> None:
    now = _nova_sec_now_iso()
    conn.execute('''
        INSERT INTO npcs(id,name,role,level,avatar,guild_tag,faction_id,x,y,location_id,galaxy_id,traveling,
                         origin_x,origin_y,destination_x,destination_y,destination_id,start_time,arrival_time,
                         stance,counter_scan_id,equipment_summary,hp,max_hp,active,updated_at)
        VALUES(:id,:name,:role,:level,:avatar,:guild_tag,:faction_id,:x,:y,:location_id,:galaxy_id,:traveling,
               :origin_x,:origin_y,:destination_x,:destination_y,:destination_id,:start_time,:arrival_time,
               :stance,:counter_scan_id,:equipment_summary,:hp,:max_hp,:active,:updated_at)
        ON CONFLICT(id) DO UPDATE SET
          name=excluded.name,
          role=excluded.role,
          level=excluded.level,
          avatar=excluded.avatar,
          guild_tag=excluded.guild_tag,
          faction_id=excluded.faction_id,
          x=excluded.x,
          y=excluded.y,
          location_id=excluded.location_id,
          galaxy_id=excluded.galaxy_id,
          traveling=0,
          stance=excluded.stance,
          counter_scan_id=excluded.counter_scan_id,
          equipment_summary=excluded.equipment_summary,
          max_hp=excluded.max_hp,
          hp=CASE WHEN npcs.hp <= 0 OR npcs.active=0 THEN npcs.hp ELSE MIN(npcs.hp, excluded.max_hp) END,
          active=CASE WHEN npcs.hp <= 0 THEN 0 ELSE excluded.active END,
          updated_at=excluded.updated_at
    ''', {
        'id': npc['id'],
        'name': npc['name'],
        'role': npc.get('role') or 'patrol',
        'level': _nova_sec_int(npc.get('level'), 1),
        'avatar': npc.get('avatar') or '◌',
        'guild_tag': npc.get('guild_tag') or 'SEC',
        'faction_id': npc.get('faction_id') or 'contested',
        'x': _nova_sec_int(npc.get('x'), 5000),
        'y': _nova_sec_int(npc.get('y'), 5000),
        'location_id': npc.get('location_id'),
        'galaxy_id': npc.get('galaxy_id') or 'unknown',
        'traveling': 0,
        'origin_x': None,
        'origin_y': None,
        'destination_x': None,
        'destination_y': None,
        'destination_id': None,
        'start_time': None,
        'arrival_time': None,
        'stance': npc.get('stance') or 'lawful',
        'counter_scan_id': npc.get('counter_scan_id') or 'none',
        'equipment_summary': npc.get('equipment_summary') or '',
        'hp': _nova_sec_int(npc.get('hp'), 100),
        'max_hp': _nova_sec_int(npc.get('max_hp'), 100),
        'active': _nova_sec_int(npc.get('active'), 1),
        'updated_at': now,
    })


def _nova_sec_seeded_point(galaxy_id: str, slot: int, base_x=5000, base_y=5000, radius=3200) -> tuple[int, int]:
    seed = abs(hash(f'{galaxy_id}:{slot}:nova-sec')) % 1000003
    rng = _nova_sec_random.Random(seed)
    angle = rng.random() * _nova_sec_math.tau
    dist = radius * (0.25 + rng.random() * 0.75)
    return int(max(650, min(9350, base_x + _nova_sec_math.cos(angle) * dist))), int(max(650, min(9350, base_y + _nova_sec_math.sin(angle) * dist)))


def _nova_sec_spawn_turrets(conn, g: dict, settings: dict[str, str]) -> None:
    gid = str(g.get('galaxy_id'))
    sec = _nova_sec_num(g.get('security_level'), 0.5)
    owner = str(g.get('owner_faction') or 'contested')
    base = _nova_sec_base_turrets(sec)
    if base <= 0:
        return
    multiplier = max(1, min(_nova_sec_int(settings.get('max_turret_multiplier'), 8), _nova_sec_int(g.get('turret_multiplier'), 1)))
    desired_total = base * multiplier
    gates = _nova_sec_gate_rows(conn, gid)
    if not gates:
        return
    per_gate = max(1, int(_nova_sec_math.ceil(desired_total / max(1, len(gates)))))
    hp = int(120 + sec * 240)
    level = int(10 + sec * 35)
    slot = 0
    for gate in gates:
        gx = _nova_sec_int(gate.get('x'), 5000)
        gy = _nova_sec_int(gate.get('y'), 5000)
        gate_id = str(gate.get('id') or gate.get('name') or f'gate-{slot}')
        for i in range(per_gate):
            if slot >= desired_total:
                break
            angle = (i / max(1, per_gate)) * _nova_sec_math.tau
            offset = 165 + (i % 2) * 85
            x = int(max(350, min(9650, gx + _nova_sec_math.cos(angle) * offset)))
            y = int(max(350, min(9650, gy + _nova_sec_math.sin(angle) * offset)))
            npc_id = f'sec_turret:{gid}:{gate_id}:{slot}'
            row = _nova_sec_row(conn, 'SELECT active,hp FROM npcs WHERE id=?', (npc_id,))
            if row and (_nova_sec_int(row.get('active'), 1) == 0 or _nova_sec_int(row.get('hp'), hp) <= 0):
                continue
            _nova_sec_upsert_npc(conn, {
                'id': npc_id,
                'name': f'{owner.title()} Gate Turret {slot + 1}',
                'role': 'escort',
                'level': level,
                'avatar': '◉',
                'guild_tag': 'SEC',
                'faction_id': owner,
                'x': x,
                'y': y,
                'location_id': gate_id,
                'galaxy_id': gid,
                'stance': 'lawful',
                'counter_scan_id': 'gate_turret',
                'equipment_summary': 'defense turret; stationary; targets bounties and opposing factions',
                'hp': hp,
                'max_hp': hp,
                'active': 1,
            })
            conn.execute('''
                INSERT OR REPLACE INTO security_defense_registry(npc_id,galaxy_id,defense_type,gate_id,faction_id,base_slot,spawned_at,respawn_after,last_seen_alive,status)
                VALUES(?,?,?,?,?,?,?,?,?,?)
            ''', (npc_id, gid, 'turret', gate_id, owner, slot, _nova_sec_time.time(), 0, _nova_sec_time.time(), 'active'))
            slot += 1


def _nova_sec_spawn_patrols(conn, g: dict, settings: dict[str, str]) -> None:
    gid = str(g.get('galaxy_id'))
    sec = _nova_sec_num(g.get('security_level'), 0.5)
    owner = str(g.get('owner_faction') or 'contested')
    base = _nova_sec_base_patrols(sec)
    if base <= 0:
        return
    max_bonus = _nova_sec_int(settings.get('max_patrol_bonus'), 6)
    bonus = max(0, min(max_bonus, _nova_sec_int(g.get('patrol_bonus'), 0)))
    desired = base + bonus
    hp = int(90 + sec * 160)
    level = int(6 + sec * 30)
    for slot in range(desired):
        npc_id = f'sec_patrol:{gid}:{slot}'
        row = _nova_sec_row(conn, 'SELECT active,hp FROM npcs WHERE id=?', (npc_id,))
        if row and (_nova_sec_int(row.get('active'), 1) == 0 or _nova_sec_int(row.get('hp'), hp) <= 0):
            continue
        x, y = _nova_sec_seeded_point(gid, slot, 5000, 5000, 3900)
        _nova_sec_upsert_npc(conn, {
            'id': npc_id,
            'name': f'{owner.title()} Patrol {slot + 1}',
            'role': 'patrol',
            'level': level,
            'avatar': '◌',
            'guild_tag': 'SEC',
            'faction_id': owner,
            'x': x,
            'y': y,
            'location_id': f'{gid}-patrol-zone-{slot}',
            'galaxy_id': gid,
            'stance': 'lawful',
            'counter_scan_id': 'security_patrol',
            'equipment_summary': 'security patrol; targets bounties and opposing factions',
            'hp': hp,
            'max_hp': hp,
            'active': 1,
        })
        conn.execute('''
            INSERT OR REPLACE INTO security_defense_registry(npc_id,galaxy_id,defense_type,gate_id,faction_id,base_slot,spawned_at,respawn_after,last_seen_alive,status)
            VALUES(?,?,?,?,?,?,?,?,?,?)
        ''', (npc_id, gid, 'patrol', None, owner, slot, _nova_sec_time.time(), 0, _nova_sec_time.time(), 'active'))


def _nova_sec_active_count(conn, galaxy_id: str, prefix: str) -> int:
    try:
        row = _nova_sec_row(conn, 'SELECT COUNT(*) AS n FROM npcs WHERE galaxy_id=? AND id LIKE ? AND COALESCE(active,1)=1 AND COALESCE(hp,1)>0', (galaxy_id, prefix + '%'))
        return _nova_sec_int((row or {}).get('n'), 0)
    except Exception:
        return 0


def _nova_sec_handle_escalation(conn, g: dict, settings: dict[str, str], now_ts: float) -> dict:
    gid = str(g.get('galaxy_id'))
    sec = _nova_sec_num(g.get('security_level'), 0.5)
    base_turrets = _nova_sec_base_turrets(sec)
    base_patrols = _nova_sec_base_patrols(sec)
    quiet_turret = _nova_sec_int(settings.get('turret_escalation_quiet_seconds'), 3600)
    quiet_patrol = _nova_sec_int(settings.get('patrol_escalation_quiet_seconds'), 3600)
    max_mult = max(1, _nova_sec_int(settings.get('max_turret_multiplier'), 8))
    max_patrol_bonus = max(0, _nova_sec_int(settings.get('max_patrol_bonus'), 6))
    turret_mult = max(1, min(max_mult, _nova_sec_int(g.get('turret_multiplier'), 1)))
    patrol_bonus = max(0, min(max_patrol_bonus, _nova_sec_int(g.get('patrol_bonus'), 0)))
    turret_last_loss = _nova_sec_num(g.get('turret_last_loss_ts'), 0)
    patrol_last_loss = _nova_sec_num(g.get('patrol_last_loss_ts'), 0)

    active_turrets = _nova_sec_active_count(conn, gid, 'sec_turret:')
    active_patrols = _nova_sec_active_count(conn, gid, 'sec_patrol:')

    if turret_last_loss and now_ts - turret_last_loss >= quiet_turret:
        turret_mult = 1
        turret_last_loss = 0
    if patrol_last_loss and now_ts - patrol_last_loss >= quiet_patrol:
        patrol_bonus = 0
        patrol_last_loss = 0

    # If all expected turrets are gone, double the next wave. Cap keeps it from becoming a wall.
    if base_turrets > 0 and active_turrets == 0:
        if now_ts - turret_last_loss > 15:
            turret_mult = min(max_mult, max(2, turret_mult * 2))
            turret_last_loss = now_ts
            conn.execute('UPDATE galaxy_security_state SET turret_wipe_count=COALESCE(turret_wipe_count,0)+1 WHERE galaxy_id=?', (gid,))
    # Patrols escalate slowly. One extra per cycle, not doubling.
    if base_patrols > 0 and active_patrols < max(1, base_patrols // 2):
        if now_ts - patrol_last_loss > 60:
            patrol_bonus = min(max_patrol_bonus, patrol_bonus + 1)
            patrol_last_loss = now_ts

    conn.execute('''
        UPDATE galaxy_security_state
        SET turret_multiplier=?, turret_last_loss_ts=?, patrol_bonus=?, patrol_last_loss_ts=?, updated_at=?
        WHERE galaxy_id=?
    ''', (turret_mult, turret_last_loss, patrol_bonus, patrol_last_loss, _nova_sec_now_iso(), gid))
    g['turret_multiplier'] = turret_mult
    g['patrol_bonus'] = patrol_bonus
    g['turret_last_loss_ts'] = turret_last_loss
    g['patrol_last_loss_ts'] = patrol_last_loss
    return g


def _nova_sec_respawn_dead_defenders(conn, settings: dict[str, str], now_ts: float, war_active_by_galaxy: dict[str, int]) -> None:
    turret_respawn = _nova_sec_int(settings.get('turret_respawn_seconds'), 600)
    patrol_respawn = _nova_sec_int(settings.get('patrol_respawn_seconds'), 420)
    try:
        dead = _nova_sec_rows(conn, "SELECT id, galaxy_id FROM npcs WHERE id LIKE 'sec_%' AND (COALESCE(active,1)=0 OR COALESCE(hp,0)<=0)")
    except Exception:
        return
    for npc in dead:
        npc_id = str(npc.get('id'))
        gid = str(npc.get('galaxy_id'))
        if war_active_by_galaxy.get(gid):
            continue
        is_turret = npc_id.startswith('sec_turret:')
        delay = turret_respawn if is_turret else patrol_respawn
        reg = _nova_sec_row(conn, 'SELECT respawn_after FROM security_defense_registry WHERE npc_id=?', (npc_id,))
        due = _nova_sec_num((reg or {}).get('respawn_after'), 0)
        if due <= 0:
            due = now_ts + delay
            conn.execute('UPDATE security_defense_registry SET status=?, respawn_after=? WHERE npc_id=?', ('destroyed', due, npc_id))
        elif now_ts >= due:
            # Delete the dead row. Next spawn pass recreates it at proper count/faction.
            conn.execute('DELETE FROM npcs WHERE id=?', (npc_id,))
            conn.execute('DELETE FROM security_defense_registry WHERE npc_id=?', (npc_id,))


def _nova_sec_player_context(conn, player_like=None) -> dict:
    p = player_like or {}
    if not isinstance(p, dict):
        try:
            p = dict(p)
        except Exception:
            p = {}
    ctx = {
        'id': p.get('id') or p.get('player_id') or p.get('userid') or p.get('user_id'),
        'galaxy_id': p.get('galaxy_id') or p.get('galaxy'),
        'x': p.get('x') or p.get('x_pct'),
        'y': p.get('y') or p.get('y_pct'),
        'faction_id': p.get('faction_id') or p.get('faction'),
        'bounty': p.get('bounty') or p.get('bounty_amount') or p.get('wanted_level') or 0,
    }
    if not ctx.get('id'):
        return ctx
    # Fill from player/ship tables if the build_state player dict did not carry open-space position.
    if _nova_sec_table_exists(conn, 'players'):
        cols = _nova_sec_cols(conn, 'players')
        id_col = _nova_sec_first_col(cols, ('id', 'player_id'))
        faction_col = _nova_sec_first_col(cols, ('faction_id', 'faction'))
        bounty_col = _nova_sec_first_col(cols, ('bounty', 'bounty_amount', 'wanted_level'))
        gal_col = _nova_sec_first_col(cols, ('galaxy_id', 'galaxy'))
        x_col = _nova_sec_first_col(cols, ('x', 'x_pct'))
        y_col = _nova_sec_first_col(cols, ('y', 'y_pct'))
        if id_col:
            parts = [f'{id_col} AS id']
            if faction_col: parts.append(f'{faction_col} AS faction_id')
            if bounty_col: parts.append(f'{bounty_col} AS bounty')
            if gal_col: parts.append(f'{gal_col} AS galaxy_id')
            if x_col: parts.append(f'{x_col} AS x')
            if y_col: parts.append(f'{y_col} AS y')
            try:
                row = _nova_sec_row(conn, f"SELECT {', '.join(parts)} FROM players WHERE {id_col}=?", (ctx.get('id'),))
                if row:
                    for k in ctx:
                        if ctx.get(k) in (None, '') and row.get(k) not in (None, ''):
                            ctx[k] = row.get(k)
            except Exception:
                pass
    if _nova_sec_table_exists(conn, 'ships'):
        cols = _nova_sec_cols(conn, 'ships')
        player_col = _nova_sec_first_col(cols, ('player_id', 'owner_id', 'user_id'))
        active_col = _nova_sec_first_col(cols, ('active', 'is_active', 'selected'))
        gal_col = _nova_sec_first_col(cols, ('galaxy_id', 'galaxy'))
        x_col = _nova_sec_first_col(cols, ('x', 'x_pct'))
        y_col = _nova_sec_first_col(cols, ('y', 'y_pct'))
        if player_col and (not ctx.get('galaxy_id') or ctx.get('x') is None or ctx.get('y') is None):
            parts = []
            if gal_col: parts.append(f'{gal_col} AS galaxy_id')
            if x_col: parts.append(f'{x_col} AS x')
            if y_col: parts.append(f'{y_col} AS y')
            if parts:
                where = f'{player_col}=?'
                if active_col:
                    where += f' AND COALESCE({active_col},1)=1'
                try:
                    row = _nova_sec_row(conn, f"SELECT {', '.join(parts)} FROM ships WHERE {where} LIMIT 1", (ctx.get('id'),))
                    if row:
                        for k in ('galaxy_id', 'x', 'y'):
                            if ctx.get(k) in (None, '') and row.get(k) not in (None, ''):
                                ctx[k] = row.get(k)
                except Exception:
                    pass
    return ctx


def _nova_sec_should_target(player_ctx: dict, defender_faction: str) -> tuple[bool, str]:
    bounty = _nova_sec_num(player_ctx.get('bounty'), 0)
    if bounty > 0:
        return True, 'bounty'
    pf = str(player_ctx.get('faction_id') or '').lower().strip()
    df = str(defender_faction or '').lower().strip()
    if df and df != 'contested' and pf and pf != df:
        return True, 'opposing_faction'
    return False, ''


def _nova_sec_try_existing_battle_helper(conn, defender: dict, player_ctx: dict, reason: str) -> bool:
    # Compatibility layer only. Uses existing battle helpers if the project has them.
    # Every call is guarded because helper signatures changed across Nova builds.
    candidates = (
        'start_security_battle',
        'start_npc_battle',
        'start_open_space_battle',
        'start_intercept_battle',
        'create_battle',
        'start_battle',
        'begin_battle',
    )
    for name in candidates:
        fn = globals().get(name)
        if not callable(fn):
            continue
        attempts = (
            lambda: fn(conn, player_ctx.get('id'), defender.get('id'), reason=reason, multi_attackers=True),
            lambda: fn(conn, player_ctx.get('id'), defender.get('id')),
            lambda: fn(conn, player_ctx, defender),
            lambda: fn(player_ctx, defender),
        )
        for call in attempts:
            try:
                result = call()
                if result is not False:
                    return True
            except TypeError:
                continue
            except Exception:
                continue
    return False


def _nova_sec_record_or_start_engagement(conn, defender: dict, player_ctx: dict, reason: str) -> None:
    pid = str(player_ctx.get('id') or '')
    if not pid:
        return
    now_ts = _nova_sec_time.time()
    recent = _nova_sec_row(conn, '''
        SELECT id FROM security_auto_engagements
        WHERE target_player_id=? AND defender_npc_id=? AND created_ts>=? AND resolved=0
        LIMIT 1
    ''', (pid, defender.get('id'), now_ts - 20))
    if recent:
        return
    if _nova_sec_try_existing_battle_helper(conn, defender, player_ctx, reason):
        resolved = 1
    else:
        resolved = 0
    conn.execute('''
        INSERT INTO security_auto_engagements(galaxy_id,defender_npc_id,target_player_id,reason,created_ts,created_at,resolved)
        VALUES(?,?,?,?,?,?,?)
    ''', (defender.get('galaxy_id'), defender.get('id'), pid, reason, now_ts, _nova_sec_now_iso(), resolved))


def _nova_sec_scan_player_engagements(conn, player_like, settings: dict[str, str]) -> None:
    player_ctx = _nova_sec_player_context(conn, player_like)
    gid = str(player_ctx.get('galaxy_id') or '')
    if not gid or player_ctx.get('x') is None or player_ctx.get('y') is None:
        return
    px = _nova_sec_num(player_ctx.get('x'), 5000)
    py = _nova_sec_num(player_ctx.get('y'), 5000)
    turret_range = _nova_sec_num(settings.get('turret_base_range'), 520) * _nova_sec_num(settings.get('turret_range_multiplier'), 3)
    patrol_range = _nova_sec_num(settings.get('patrol_threat_range'), 360)
    try:
        defenders = _nova_sec_rows(conn, '''
            SELECT id,name,role,faction_id,x,y,galaxy_id,equipment_summary
            FROM npcs
            WHERE galaxy_id=?
              AND id LIKE 'sec_%'
              AND COALESCE(active,1)=1
              AND COALESCE(hp,1)>0
        ''', (gid,))
    except Exception:
        return
    for d in defenders:
        should, reason = _nova_sec_should_target(player_ctx, str(d.get('faction_id') or ''))
        if not should:
            continue
        dx = _nova_sec_num(d.get('x'), 5000) - px
        dy = _nova_sec_num(d.get('y'), 5000) - py
        dist = _nova_sec_math.sqrt(dx * dx + dy * dy)
        is_turret = str(d.get('id') or '').startswith('sec_turret:')
        rng = turret_range if is_turret else patrol_range
        if dist <= rng:
            _nova_sec_record_or_start_engagement(conn, d, player_ctx, reason)


def nova_security_defense_tick(conn, player_like=None) -> None:
    nova_security_ensure_tables(conn)
    settings = _nova_sec_setting_map(conn)
    now_ts = _nova_sec_time.time()
    last_global = _nova_sec_row(conn, 'SELECT value FROM security_settings WHERE key=?', ('last_global_security_tick_ts',))
    tick_seconds = _nova_sec_int(settings.get('security_tick_seconds'), 8)
    if last_global and now_ts - _nova_sec_num(last_global.get('value'), 0) < tick_seconds:
        _nova_sec_scan_player_engagements(conn, player_like, settings)
        return
    conn.execute('INSERT OR REPLACE INTO security_settings(key,value,updated_at) VALUES(?,?,?)', ('last_global_security_tick_ts', str(now_ts), _nova_sec_now_iso()))
    _nova_sec_sync_galaxy_state(conn)
    states = _nova_sec_rows(conn, 'SELECT * FROM galaxy_security_state')
    war_by_galaxy = {str(g.get('galaxy_id')): _nova_sec_int(g.get('war_active'), 0) for g in states}
    _nova_sec_respawn_dead_defenders(conn, settings, now_ts, war_by_galaxy)
    for g in _nova_sec_rows(conn, 'SELECT * FROM galaxy_security_state'):
        gid = str(g.get('galaxy_id'))
        if _nova_sec_int(g.get('war_active'), 0):
            continue
        g = _nova_sec_handle_escalation(conn, g, settings, now_ts)
        _nova_sec_spawn_turrets(conn, g, settings)
        _nova_sec_spawn_patrols(conn, g, settings)
        conn.execute('UPDATE galaxy_security_state SET last_tick_ts=?, updated_at=? WHERE galaxy_id=?', (now_ts, _nova_sec_now_iso(), gid))
    _nova_sec_scan_player_engagements(conn, player_like, settings)
    try:
        conn.commit()
    except Exception:
        pass


def nova_security_snapshot(conn, galaxy_id: str | None = None, player_id: str | int | None = None) -> dict:
    nova_security_ensure_tables(conn)
    _nova_sec_sync_galaxy_state(conn)
    params: list = []
    where = ''
    if galaxy_id:
        where = 'WHERE galaxy_id=?'
        params.append(galaxy_id)
    rows = _nova_sec_rows(conn, f'SELECT * FROM galaxy_security_state {where} ORDER BY security_level DESC, galaxy_id', tuple(params))
    out = []
    for g in rows:
        gid = str(g.get('galaxy_id'))
        turrets = _nova_sec_active_count(conn, gid, 'sec_turret:')
        patrols = _nova_sec_active_count(conn, gid, 'sec_patrol:')
        out.append({
            'galaxy_id': gid,
            'security_level': round(_nova_sec_num(g.get('security_level'), 0.5), 2),
            'owner_faction': g.get('owner_faction'),
            'war_active': bool(_nova_sec_int(g.get('war_active'), 0)),
            'turret_count': turrets,
            'turret_multiplier': _nova_sec_int(g.get('turret_multiplier'), 1),
            'patrol_count': patrols,
            'patrol_bonus': _nova_sec_int(g.get('patrol_bonus'), 0),
        })
    settings = _nova_sec_setting_map(conn)
    alerts = []
    if player_id is not None:
        alerts = _nova_sec_rows(conn, '''
            SELECT id, galaxy_id, defender_npc_id, reason, created_at, resolved
            FROM security_auto_engagements
            WHERE target_player_id=? AND created_ts>=? AND resolved=0
            ORDER BY id DESC LIMIT 5
        ''', (str(player_id), _nova_sec_time.time() - 120))
    return {'galaxies': out, 'settings': settings, 'alerts': alerts, 'server_time': _nova_sec_now_iso()}


@app.get('/api/security/state')
def nova_security_state(galaxy_id: str | None = None, player_id: str | None = None):
    # Uses same connection style as current main.py endpoints when possible.
    conn = None
    try:
        if callable(globals().get('get_conn')):
            conn = globals()['get_conn']()
        elif callable(globals().get('get_connection')):
            conn = globals()['get_connection']()
        elif callable(globals().get('connect_db')):
            conn = globals()['connect_db']()
        else:
            db_path = None
            for candidate in ('backend/app/data/nova_frontiers.db', 'app/data/nova_frontiers.db', 'data/nova_frontiers.db', 'nova_frontiers.db'):
                try:
                    from pathlib import Path as _NovaSecPath
                    p = _NovaSecPath(candidate)
                    if p.exists():
                        db_path = p
                        break
                except Exception:
                    pass
            if db_path is None:
                _nova_sec_raise(500, 'Security database connection could not be resolved')
            conn = _nova_sec_sqlite3.connect(str(db_path), check_same_thread=False)
            conn.row_factory = _nova_sec_sqlite3.Row
        nova_security_defense_tick(conn, {'id': player_id} if player_id else None)
        return nova_security_snapshot(conn, galaxy_id, player_id)
    finally:
        try:
            if conn is not None:
                conn.close()
        except Exception:
            pass


@app.post('/api/admin/security/settings')
def nova_security_update_settings(req: NovaSecuritySettingsRequest):
    # Admin integration varies across Nova builds. This endpoint updates only security knobs.
    conn = None
    try:
        if callable(globals().get('get_conn')):
            conn = globals()['get_conn']()
        elif callable(globals().get('get_connection')):
            conn = globals()['get_connection']()
        elif callable(globals().get('connect_db')):
            conn = globals()['connect_db']()
        else:
            from pathlib import Path as _NovaSecPath
            db_path = _NovaSecPath('backend/app/data/nova_frontiers.db')
            if not db_path.exists():
                db_path = _NovaSecPath('data/nova_frontiers.db')
            conn = _nova_sec_sqlite3.connect(str(db_path), check_same_thread=False)
            conn.row_factory = _nova_sec_sqlite3.Row
        nova_security_ensure_tables(conn)
        data = req.dict() if hasattr(req, 'dict') else req.__dict__
        allowed = {
            'turret_respawn_seconds', 'turret_escalation_quiet_seconds', 'turret_range_multiplier',
            'max_turret_multiplier', 'patrol_respawn_seconds', 'patrol_escalation_quiet_seconds', 'max_patrol_bonus'
        }
        for key in allowed:
            value = data.get(key)
            if value is not None:
                conn.execute('INSERT OR REPLACE INTO security_settings(key,value,updated_at) VALUES(?,?,?)', (key, str(value), _nova_sec_now_iso()))
        if data.get('set_war_galaxy_id'):
            conn.execute('''
                INSERT INTO galaxy_security_state(galaxy_id, security_level, owner_faction, war_active, updated_at)
                VALUES(?,?,?,?,?)
                ON CONFLICT(galaxy_id) DO UPDATE SET war_active=excluded.war_active, updated_at=excluded.updated_at
            ''', (str(data.get('set_war_galaxy_id')), 0.5, 'contested', 1 if data.get('set_war_active') else 0, _nova_sec_now_iso()))
        conn.commit()
        return nova_security_snapshot(conn)
    finally:
        try:
            if conn is not None:
                conn.close()
        except Exception:
            pass
"""

    if MARKER_BACKEND not in text:
        # Prefer before request models or state functions so helper names exist before call insertion.
        markers = [
            'class LoginRequest(BaseModel):',
            'class RegisterRequest(BaseModel):',
            'def build_state',
            'if __name__ == "__main__":',
            "if __name__ == '__main__':",
        ]
        for marker in markers:
            idx = text.find(marker)
            if idx != -1:
                text = text[:idx] + helper_block + '\n\n' + text[idx:]
                break
        else:
            text = text.rstrip() + helper_block + '\n'
    else:
        skipped.append('backend/app/main.py: security helper marker already present')

    if MARKER_BUILD_STATE not in text:
        call_line = f'    # {MARKER_BUILD_STATE}\n    try:\n        nova_security_defense_tick(conn, locals().get("player") or locals().get("p") or {{}})\n    except Exception:\n        pass\n'
        pattern = re.compile(r'(def\s+build_state\s*\([^\)]*\)\s*(?:->\s*[^:]+)?\s*:\s*\n)')
        if pattern.search(text):
            text = pattern.sub(lambda m: m.group(1) + call_line, text, count=1)
        else:
            skipped.append('backend build_state hook: def build_state marker not found')
    else:
        skipped.append('backend/app/main.py: build_state tick marker already present')

    write_if_changed(BACKEND, original, text, 'backend/app/main.py')


def patch_frontend() -> None:
    if not FRONTEND.exists():
        skipped.append('frontend/src/main.jsx: not found')
        return
    text = read_text(FRONTEND)
    original = text
    if MARKER_FRONTEND in text:
        skipped.append('frontend/src/main.jsx: security overlay marker already present')
        return

    block = r'''

// NOVA_SECURITY_DEFENSE_FRONTEND_OVERLAY_V1
// Passive security-status overlay. Does not poll unless opened.
(function novaSecurityDefenseOverlay(){
  if (typeof window === 'undefined' || typeof document === 'undefined' || window.__novaSecurityDefenseOverlay) return;
  window.__novaSecurityDefenseOverlay = true;

  function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  async function getJson(url){
    const res = await fetch(url, {credentials:'include'});
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok) throw new Error(data?.detail || data?.error || `Request failed ${res.status}`);
    return data;
  }
  function ensure(){
    let root = document.querySelector('[data-nova-security-overlay]');
    if (root) return root;
    root = document.createElement('div');
    root.setAttribute('data-nova-security-overlay', '1');
    root.className = 'novaSecurityOverlay minimized';
    root.innerHTML = `
      <button type="button" class="novaSecurityToggle" title="Galaxy Security">SEC</button>
      <div class="novaSecurityPanel">
        <div class="novaSecurityHead">
          <strong>Galaxy Security</strong>
          <button type="button" class="novaSecurityClose">×</button>
        </div>
        <div class="novaSecurityBody">Open to load security state.</div>
      </div>`;
    document.body.appendChild(root);
    root.querySelector('.novaSecurityToggle')?.addEventListener('click', async () => {
      root.classList.toggle('minimized');
      if (!root.classList.contains('minimized')) await load(root);
    });
    root.querySelector('.novaSecurityClose')?.addEventListener('click', () => root.classList.add('minimized'));
    return root;
  }
  async function load(root){
    const body = root.querySelector('.novaSecurityBody');
    if (!body) return;
    body.innerHTML = '<div class="novaSecurityMuted">Loading security state...</div>';
    try {
      const data = await getJson('/api/security/state');
      const rows = (data.galaxies || []).slice(0, 20);
      body.innerHTML = rows.length ? rows.map(g => `
        <div class="novaSecurityRow ${g.war_active ? 'war' : ''}">
          <div><strong>${esc(g.galaxy_id)}</strong><span>${esc(g.owner_faction || 'contested')}</span></div>
          <div class="novaSecurityPill">SEC ${Number(g.security_level || 0).toFixed(1)}</div>
          <div class="novaSecurityStats">T ${g.turret_count ?? 0} ×${g.turret_multiplier ?? 1} · P ${g.patrol_count ?? 0}${g.patrol_bonus ? ` +${g.patrol_bonus}` : ''}${g.war_active ? ' · WAR' : ''}</div>
        </div>`).join('') : '<div class="novaSecurityMuted">No galaxy security state yet.</div>';
    } catch (err) {
      body.innerHTML = `<div class="novaSecurityMuted">${esc(err.message || err)}</div>`;
    }
  }
  function boot(){ ensure(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
'''
    text = text.rstrip() + block + '\n'
    write_if_changed(FRONTEND, original, text, 'frontend/src/main.jsx')


def patch_css() -> None:
    if not CSS.exists():
        skipped.append('frontend/src/styles.css: not found')
        return
    text = read_text(CSS)
    original = text
    if MARKER_CSS in text:
        skipped.append('frontend/src/styles.css: css marker already present')
        return
    block = r'''

/* NOVA_SECURITY_DEFENSE_CSS_V1 */
.novaSecurityOverlay{position:fixed;left:18px;bottom:18px;z-index:9997;font-family:inherit;color:#e8f5ff}
.novaSecurityToggle{width:44px;height:44px;border-radius:999px;border:1px solid rgba(120,210,255,.5);background:rgba(8,18,30,.82);color:#aee8ff;font-weight:900;box-shadow:0 10px 30px rgba(0,0,0,.35);cursor:pointer}
.novaSecurityPanel{width:min(420px,calc(100vw - 36px));max-height:52vh;overflow:auto;border:1px solid rgba(120,210,255,.28);border-radius:18px;background:rgba(5,12,22,.86);backdrop-filter:blur(10px);box-shadow:0 18px 60px rgba(0,0,0,.45)}
.novaSecurityOverlay.minimized .novaSecurityPanel{display:none}
.novaSecurityHead{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.08)}
.novaSecurityClose{border:0;background:transparent;color:#dff6ff;font-size:22px;cursor:pointer}
.novaSecurityBody{padding:10px;display:grid;gap:8px}
.novaSecurityRow{display:grid;grid-template-columns:1fr auto;gap:4px 10px;padding:10px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(255,255,255,.045)}
.novaSecurityRow.war{border-color:rgba(255,100,100,.45);background:rgba(120,20,20,.18)}
.novaSecurityRow span{display:block;color:#9db4c4;font-size:12px;margin-top:2px}
.novaSecurityPill{align-self:start;border:1px solid rgba(120,210,255,.28);border-radius:999px;padding:3px 8px;color:#aee8ff;font-size:12px;font-weight:800}
.novaSecurityStats{grid-column:1/-1;color:#cddbe5;font-size:12px;letter-spacing:.02em}
.novaSecurityMuted{color:#9db4c4;padding:10px;font-size:13px}
'''
    text = text.rstrip() + block + '\n'
    write_if_changed(CSS, original, text, 'frontend/src/styles.css')


def write_doc() -> None:
    old = DOC.read_text(encoding='utf-8') if DOC.exists() else None
    content = f'''# NOVA_SECURITY_DEFENSE_SYSTEM_NOTES_V1

Security-defense pass added by `apply_nova_security_defense_system_patch.py`.

## Implemented model

- Home/safe/capital galaxies resolve to `1.0` security.
- Dead-center/center/null/core galaxies resolve to `0.0` security.
- Galaxies with coordinates resolve security from distance to map center: center is low, rim is high.
- Border/frontier/war-named fallback galaxies default lower security if no coordinates exist.
- Gate turrets spawn near gate/crossing/jump/relay planets.
- If real gate planets are missing, four deterministic fallback gates are used so the system still works.
- Turrets are stationary NPCs in the existing `npcs` traffic model.
- Turret range is `turret_base_range * turret_range_multiplier`; default multiplier is 3.
- Turrets target bountied players and opposing factions.
- Patrols scale by security level, but are capped and escalate slowly.
- If all turrets in a galaxy are destroyed, the next spawn wave doubles up to `max_turret_multiplier`.
- If no turret losses occur for `turret_escalation_quiet_seconds`, multiplier resets.
- Patrols add only one bonus patrol per loss cycle up to `max_patrol_bonus`.
- Active war galaxies stop spawning replacements. Existing turrets/patrols remain until defeated.
- When war is cleared, normal faction/security spawning resumes.

## Admin settings endpoint

POST `/api/admin/security/settings`

Body fields:

```json
{{
  "turret_respawn_seconds": 600,
  "turret_escalation_quiet_seconds": 3600,
  "turret_range_multiplier": 3,
  "max_turret_multiplier": 8,
  "patrol_respawn_seconds": 420,
  "patrol_escalation_quiet_seconds": 3600,
  "max_patrol_bonus": 6,
  "set_war_galaxy_id": "border-1",
  "set_war_active": true
}}
```

## Read endpoint

GET `/api/security/state`

Optional query params:

- `galaxy_id`
- `player_id`

## Integration detail

The patch hooks `build_state(conn, user, p)` and runs `nova_security_defense_tick(conn, player)` once per security tick window. This keeps world defense state server-side and avoids adding heavy frontend polling.

## Local validation

Run:

```bat
python -m py_compile backend\app\main.py
cd frontend
npm run build
```
'''
    write_if_changed(DOC, old, content, 'NOVA_SECURITY_DEFENSE_SYSTEM_NOTES.md')


def main() -> None:
    patch_backend()
    patch_frontend()
    patch_css()
    write_doc()
    print('Changed:')
    for item in changed:
        print(f'  - {item}')
    if skipped:
        print('Skipped:')
        for item in skipped:
            print(f'  - {item}')
    if not changed:
        print('No files changed.')


if __name__ == '__main__':
    main()
