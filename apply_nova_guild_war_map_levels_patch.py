from pathlib import Path
import re
import sys

ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd()

backend = ROOT / 'backend' / 'app' / 'main.py'
frontend = ROOT / 'frontend' / 'src' / 'main.jsx'
styles = ROOT / 'frontend' / 'src' / 'styles.css'

for p in [backend, frontend, styles]:
    if not p.exists():
        raise SystemExit(f'Missing expected file: {p}')


def ensure_once(text: str, marker: str, block: str) -> str:
    if marker in text:
        return text
    return text + '\n\n' + block.strip() + '\n'

# ------------------------------
# backend/app/main.py
# ------------------------------
main_text = backend.read_text(encoding='utf-8')

backend_block = r'''
# === NOVA_GUILD_WAR_MAP_LEVELS_PATCH_BEGIN ===
def nova_now_iso():
    try:
        return datetime.utcnow().isoformat()
    except Exception:
        import datetime as _dt
        return _dt.datetime.utcnow().isoformat()


def nova__table_exists(conn, table_name):
    try:
        row = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,)).fetchone()
        return bool(row)
    except Exception:
        return False


def nova_is_guild_war_active(conn, guild_a_id, guild_b_id):
    if not guild_a_id or not guild_b_id or guild_a_id == guild_b_id:
        return False
    if not nova__table_exists(conn, 'guild_wars'):
        return False
    now_iso = nova_now_iso()
    try:
        row = conn.execute(
            """
            SELECT 1
            FROM guild_wars
            WHERE ((attacker_guild_id = ? AND defender_guild_id = ?) OR (attacker_guild_id = ? AND defender_guild_id = ?))
              AND status IN ('pending', 'preparation', 'active')
              AND (end_at IS NULL OR end_at >= ?)
            LIMIT 1
            """,
            (guild_a_id, guild_b_id, guild_b_id, guild_a_id, now_iso)
        ).fetchone()
        return bool(row)
    except Exception:
        return False


def nova_get_player_guild_id(conn, player_id):
    if not player_id:
        return None
    for sql in (
        "SELECT guild_id FROM guild_members WHERE player_id=? ORDER BY joined_at DESC LIMIT 1",
        "SELECT guild_id FROM player_guilds WHERE player_id=? ORDER BY id DESC LIMIT 1",
        "SELECT guild_id FROM players WHERE id=? LIMIT 1",
    ):
        try:
            row = conn.execute(sql, (player_id,)).fetchone()
            if row and row[0]:
                return row[0]
        except Exception:
            pass
    return None


def nova_are_players_guild_war_hostile(conn, attacker_player_id, defender_player_id):
    attacker_guild_id = nova_get_player_guild_id(conn, attacker_player_id)
    defender_guild_id = nova_get_player_guild_id(conn, defender_player_id)
    return nova_is_guild_war_active(conn, attacker_guild_id, defender_guild_id)


def nova_build_entity_level_lookup(conn):
    lookup = {}
    for sql, kind in (
        ("SELECT id, COALESCE(level, 1) FROM players", 'player'),
        ("SELECT id, COALESCE(level, 1) FROM npcs", 'npc'),
        ("SELECT id, COALESCE(level, 1) FROM map_npcs", 'npc'),
        ("SELECT id, COALESCE(level, 1) FROM ships", 'ship'),
    ):
        try:
            for row in conn.execute(sql).fetchall():
                lookup[(kind, row[0])] = int(row[1] or 1)
        except Exception:
            pass
    return lookup


def nova_build_war_highlight_player_ids(conn, player_id=None):
    ids = set()
    try:
        if not nova__table_exists(conn, 'guild_wars'):
            return ids
        guild_id = nova_get_player_guild_id(conn, player_id) if player_id else None
        rows = conn.execute(
            """
            SELECT attacker_guild_id, defender_guild_id
            FROM guild_wars
            WHERE status IN ('pending', 'preparation', 'active')
            """
        ).fetchall()
        active_guilds = set()
        for r in rows:
            active_guilds.add(r[0])
            active_guilds.add(r[1])
        if guild_id:
            enemy_guilds = set()
            for a, d in rows:
                if a == guild_id:
                    enemy_guilds.add(d)
                elif d == guild_id:
                    enemy_guilds.add(a)
            active_guilds = enemy_guilds
        for g in list(active_guilds):
            if not g:
                continue
            try:
                member_rows = conn.execute("SELECT player_id FROM guild_members WHERE guild_id=?", (g,)).fetchall()
                ids.update(int(r[0]) for r in member_rows if r and r[0])
            except Exception:
                pass
    except Exception:
        pass
    return ids
# === NOVA_GUILD_WAR_MAP_LEVELS_PATCH_END ===
'''

main_text = ensure_once(main_text, 'NOVA_GUILD_WAR_MAP_LEVELS_PATCH_BEGIN', backend_block)

# add penalty bypass hook marker comment to help manual integration if exact combat function not found
combat_anchor_patterns = [
    r"(def\s+apply_bounty_and_jail[\s\S]*?\n)",
    r"(def\s+apply_bounty[\s\S]*?\n)",
]

if 'NOVA_GUILD_WAR_PENALTY_GUARD' not in main_text:
    inserted = False
    for pat in combat_anchor_patterns:
        m = re.search(pat, main_text)
        if m:
            block = """
# NOVA_GUILD_WAR_PENALTY_GUARD
# If a combat penalty function exists elsewhere, wrap the caller with this helper.
def nova_should_skip_bounty_and_jail(conn, attacker_player_id, defender_player_id):
    try:
        return nova_are_players_guild_war_hostile(conn, attacker_player_id, defender_player_id)
    except Exception:
        return False
"""
            main_text = main_text[:m.end()] + '\n' + block + main_text[m.end():]
            inserted = True
            break
    if not inserted:
        main_text += """

# NOVA_GUILD_WAR_PENALTY_GUARD
# Integration note:
# Call nova_should_skip_bounty_and_jail(conn, attacker_player_id, defender_player_id)
# in the bounty/jail penalty path before applying penalties for PvP combat.
def nova_should_skip_bounty_and_jail(conn, attacker_player_id, defender_player_id):
    try:
        return nova_are_players_guild_war_hostile(conn, attacker_player_id, defender_player_id)
    except Exception:
        return False
"""

backend.write_text(main_text, encoding='utf-8')

# ------------------------------
# frontend/src/main.jsx
# ------------------------------
jsx_text = frontend.read_text(encoding='utf-8')

helper_block = r'''
// === NOVA_GUILD_WAR_MAP_LEVELS_FRONTEND_BEGIN ===
function novaGetEntityLevel(entity) {
  if (!entity) return null;
  return entity.level ?? entity.ship_level ?? entity.player_level ?? entity.npc_level ?? entity.lvl ?? null;
}

function novaEntityIsWarHighlighted(entity, state) {
  if (!entity) return false;
  if (entity.guildWarHostile || entity.guild_war_hostile || entity.isWarTarget || entity.is_war_target) return true;
  const ids = new Set((state?.warHighlightPlayerIds || state?.war_highlight_player_ids || []).map((v) => Number(v)));
  const pid = Number(entity.playerId ?? entity.player_id ?? entity.id ?? 0);
  return !!(pid && ids.has(pid));
}

function NovaMapEntityBadge({ entity, state }) {
  const level = novaGetEntityLevel(entity);
  const war = novaEntityIsWarHighlighted(entity, state);
  return (
    <>
      {war ? (
        <div className="nova-war-badge" title="Guild War Target">⚔</div>
      ) : null}
      {level != null ? (
        <div className="nova-entity-level" title={`Level ${level}`}>Lv {level}</div>
      ) : null}
    </>
  );
}
// === NOVA_GUILD_WAR_MAP_LEVELS_FRONTEND_END ===
'''

jsx_text = ensure_once(jsx_text, 'NOVA_GUILD_WAR_MAP_LEVELS_FRONTEND_BEGIN', helper_block)

# Try to wrap common map marker containers with the new badge component.
marker_patterns = [
    (r'(<div className="(?:local-map-object|map-object|map-entity|ship-marker|entity-marker)[^"]*"[^>]*>)([\s\S]*?)(</div>)', True),
]

if 'NovaMapEntityBadge' in jsx_text and 'NOVA_GUILD_WAR_MAP_LEVELS_INJECTED' not in jsx_text:
    injected = False
    # insert comment to avoid double application
    def repl(match):
        open_tag, inner, close_tag = match.groups()
        nonlocal_injected = True
        return f"{open_tag}{{/* NOVA_GUILD_WAR_MAP_LEVELS_INJECTED */}}<NovaMapEntityBadge entity={{entity || obj || item || target}} state={{state}} />{inner}{close_tag}"
    # safer limited replace for first occurrence only
    simple_patterns = [
        ('className="ship-marker"', 'ship-marker'),
        ('className="map-object"', 'map-object'),
        ('className="entity-marker"', 'entity-marker'),
        ('className="local-map-object"', 'local-map-object'),
    ]
    for needle, cls in simple_patterns:
        idx = jsx_text.find(needle)
        if idx != -1:
            gt = jsx_text.find('>', idx)
            if gt != -1:
                jsx_text = jsx_text[:gt+1] + '{/* NOVA_GUILD_WAR_MAP_LEVELS_INJECTED */}<NovaMapEntityBadge entity={entity || obj || item || target} state={state} />' + jsx_text[gt+1:]
                injected = True
                break
    if not injected:
        jsx_text += """

/* NOVA_GUILD_WAR_MAP_LEVELS_INJECTED
Manual integration note:
Render <NovaMapEntityBadge entity={entity} state={state} /> inside each visible player/NPC map marker container.
Use state.warHighlightPlayerIds or entity.guildWarHostile to trigger the swords icon.
*/
"""

# ensure simple map-derived war highlight ids if build_state exposes them later
if 'warHighlightPlayerIds' not in jsx_text:
    jsx_text += """

// NOVA_GUILD_WAR_MAP_LEVELS_STATE_NOTE
// Expect state.warHighlightPlayerIds (or snake_case equivalent) from backend for map highlighting.
"""

frontend.write_text(jsx_text, encoding='utf-8')

# ------------------------------
# frontend/src/styles.css
# ------------------------------
css_text = styles.read_text(encoding='utf-8')
css_block = r'''
/* === NOVA_GUILD_WAR_MAP_LEVELS_STYLES_BEGIN === */
.nova-war-badge {
  position: absolute;
  right: -12px;
  top: 50%;
  transform: translateY(-50%);
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: #fff2d8;
  background: radial-gradient(circle at 30% 30%, #ffbb55, #ff6a00 55%, #b62000 100%);
  box-shadow: 0 0 0 2px rgba(255, 122, 0, 0.25), 0 0 14px rgba(255, 92, 0, 0.8);
  animation: novaWarPulse 1.25s ease-in-out infinite;
  z-index: 6;
  pointer-events: none;
}

.nova-entity-level {
  position: absolute;
  left: 50%;
  bottom: -18px;
  transform: translateX(-50%);
  min-width: 34px;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(5, 10, 18, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: #dce8ff;
  font-size: 10px;
  line-height: 1.2;
  text-align: center;
  white-space: nowrap;
  z-index: 5;
  pointer-events: none;
}

.ship-marker,
.entity-marker,
.map-object,
.local-map-object {
  position: relative;
}

.nova-war-highlight,
.ship-marker.nova-war-highlight,
.entity-marker.nova-war-highlight,
.map-object.nova-war-highlight,
.local-map-object.nova-war-highlight {
  box-shadow: 0 0 0 2px rgba(255, 90, 0, 0.35), 0 0 16px rgba(255, 60, 0, 0.75);
  animation: novaWarRing 1.25s ease-in-out infinite;
}

@keyframes novaWarPulse {
  0% { transform: translateY(-50%) scale(1); box-shadow: 0 0 0 2px rgba(255, 122, 0, 0.18), 0 0 10px rgba(255, 92, 0, 0.5); }
  50% { transform: translateY(-50%) scale(1.12); box-shadow: 0 0 0 5px rgba(255, 122, 0, 0.18), 0 0 20px rgba(255, 92, 0, 0.95); }
  100% { transform: translateY(-50%) scale(1); box-shadow: 0 0 0 2px rgba(255, 122, 0, 0.18), 0 0 10px rgba(255, 92, 0, 0.5); }
}

@keyframes novaWarRing {
  0% { filter: saturate(1); }
  50% { filter: saturate(1.4) brightness(1.15); }
  100% { filter: saturate(1); }
}
/* === NOVA_GUILD_WAR_MAP_LEVELS_STYLES_END === */
'''

styles.write_text(ensure_once(css_text, 'NOVA_GUILD_WAR_MAP_LEVELS_STYLES_BEGIN', css_block), encoding='utf-8')

print('Patched:')
print(f' - {backend}')
print(f' - {frontend}')
print(f' - {styles}')
