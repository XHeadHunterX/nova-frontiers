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
ROADMAP = ROOT / 'NOVA_FRONTIERS_NEXT_PASS_RECOMMENDATIONS.md'

BACKEND_MARKER = '# NOVA_MMO_100_USER_HARDENING_V1'
FRONTEND_MARKER = 'NOVA_STARTER_TUTORIAL_AND_FETCH_GUARD_V1'
CSS_MARKER = 'NOVA_STARTER_TUTORIAL_CSS_V1'
ROADMAP_MARKER = 'NOVA_FRONTIERS_NEXT_PASS_RECOMMENDATIONS_V1'

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
    if BACKEND_MARKER in text:
        skipped.append('backend/app/main.py: MMO hardening marker already present')
        return

    block = r'''

# NOVA_MMO_100_USER_HARDENING_V1
# Conservative MMO hardening for a small browser MMO target around ~100 concurrent users.
# This does not change gameplay rules. It reduces SQLite write stalls, adds common indexes,
# and avoids crashing startup on older local databases.
import os as _nova_mmo_os
import sqlite3 as _nova_mmo_sqlite3
from pathlib import Path as _NovaMmoPath

_NOVA_MMO_HARDENED_ONCE = False


def _nova_mmo_candidate_db_paths() -> list[_NovaMmoPath]:
    found: list[_NovaMmoPath] = []
    for name in ('NOVA_DB_PATH', 'DB_PATH', 'DATABASE_PATH', 'SQLITE_PATH'):
        value = globals().get(name) or _nova_mmo_os.environ.get(name)
        if value:
            found.append(_NovaMmoPath(str(value)))
    try:
        here = _NovaMmoPath(__file__).resolve().parent
    except Exception:
        here = _NovaMmoPath.cwd()
    for root in [here, *list(here.parents)[:4]]:
        for rel in (
            'data/nova_frontiers.db',
            'nova_frontiers.db',
            'data/game.db',
            'game.db',
            'database.db',
            'app.db',
            'db.sqlite3',
        ):
            found.append(root / rel)
        try:
            found.extend(root.glob('*.db'))
            found.extend((root / 'data').glob('*.db'))
        except Exception:
            pass
    out: list[_NovaMmoPath] = []
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


def _nova_mmo_table_cols(conn: _nova_mmo_sqlite3.Connection, table: str) -> set[str]:
    try:
        return {str(r[1]) for r in conn.execute(f'PRAGMA table_info({table})').fetchall()}
    except Exception:
        return set()


def _nova_mmo_table_exists(conn: _nova_mmo_sqlite3.Connection, table: str) -> bool:
    try:
        row = conn.execute('SELECT 1 FROM sqlite_master WHERE type="table" AND name=? LIMIT 1', (table,)).fetchone()
        return bool(row)
    except Exception:
        return False


def _nova_mmo_create_index_if_columns(conn: _nova_mmo_sqlite3.Connection, table: str, index: str, columns: tuple[str, ...]) -> None:
    try:
        if not _nova_mmo_table_exists(conn, table):
            return
        cols = _nova_mmo_table_cols(conn, table)
        if not all(c in cols for c in columns):
            return
        col_sql = ', '.join(columns)
        conn.execute(f'CREATE INDEX IF NOT EXISTS {index} ON {table} ({col_sql})')
    except Exception:
        return


def nova_mmo_apply_sqlite_hardening_once() -> None:
    global _NOVA_MMO_HARDENED_ONCE
    if _NOVA_MMO_HARDENED_ONCE:
        return
    _NOVA_MMO_HARDENED_ONCE = True
    db_path = None
    for candidate in _nova_mmo_candidate_db_paths():
        try:
            if candidate.exists():
                db_path = candidate
                break
        except Exception:
            continue
    if not db_path:
        return
    try:
        conn = _nova_mmo_sqlite3.connect(str(db_path), timeout=30, isolation_level=None, check_same_thread=False)
        try:
            conn.execute('PRAGMA busy_timeout=30000')
            conn.execute('PRAGMA journal_mode=WAL')
            conn.execute('PRAGMA synchronous=NORMAL')
            conn.execute('PRAGMA temp_store=MEMORY')
            conn.execute('PRAGMA foreign_keys=ON')
            conn.execute('PRAGMA wal_autocheckpoint=1000')

            # Read-path indexes used heavily by state, maps, inventory, combat, messages, and chat.
            index_specs = [
                ('players', 'idx_nova_players_user_id', ('user_id',)),
                ('players', 'idx_nova_players_username', ('username',)),
                ('players', 'idx_nova_players_faction', ('faction',)),
                ('players', 'idx_nova_players_galaxy_planet', ('galaxy_id', 'planet_id')),
                ('ships', 'idx_nova_ships_player_active', ('player_id', 'active')),
                ('ships', 'idx_nova_ships_player_location', ('player_id', 'galaxy_id', 'planet_id')),
                ('ship_cargo', 'idx_nova_ship_cargo_ship', ('ship_id',)),
                ('inventory', 'idx_nova_inventory_player_location', ('player_id', 'planet_id')),
                ('inventory', 'idx_nova_inventory_player_item', ('player_id', 'item_code')),
                ('materials', 'idx_nova_materials_player_location', ('player_id', 'planet_id')),
                ('planets', 'idx_nova_planets_galaxy', ('galaxy_id',)),
                ('stations', 'idx_nova_stations_planet', ('planet_id',)),
                ('map_objects', 'idx_nova_map_objects_galaxy_active', ('galaxy_id', 'active')),
                ('map_objects', 'idx_nova_map_objects_planet_active', ('planet_id', 'active')),
                ('travel_state', 'idx_nova_travel_state_player_active', ('player_id', 'active')),
                ('battles', 'idx_nova_battles_status_updated', ('status', 'updated_at')),
                ('battle_participants', 'idx_nova_battle_participants_battle_side', ('battle_id', 'side')),
                ('combat_logs', 'idx_nova_combat_logs_battle_id', ('battle_id',)),
                ('chat_messages', 'idx_nova_chat_messages_scope_id', ('channel', 'faction_key', 'guild_key', 'id')),
                ('direct_messages', 'idx_nova_direct_messages_recipient_time', ('recipient_id', 'created_at')),
                ('direct_messages', 'idx_nova_direct_messages_sender_time', ('sender_id', 'created_at')),
                ('server_events', 'idx_nova_server_events_active_time', ('active', 'starts_at', 'ends_at')),
                ('player_tutorial_state', 'idx_nova_tutorial_player', ('player_id',)),
            ]
            for table, index, columns in index_specs:
                _nova_mmo_create_index_if_columns(conn, table, index, columns)
        finally:
            conn.close()
    except Exception:
        return


nova_mmo_apply_sqlite_hardening_once()
'''

    # Prefer inserting before the first request model/class block. Fallback: append before main runner or at EOF.
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
            text = text[:idx] + block + '\n\n' + text[idx:]
            break
    else:
        text += block

    write_if_changed(BACKEND, original, text, 'backend/app/main.py')


def patch_frontend() -> None:
    text = read_text(FRONTEND)
    original = text
    if FRONTEND_MARKER in text:
        skipped.append('frontend/src/main.jsx: tutorial/fetch guard marker already present')
        return

    block = r'''

/* NOVA_STARTER_TUTORIAL_AND_FETCH_GUARD_V1 */
(function novaStarterTutorialAndFetchGuard(){
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // In-flight /api/state de-dupe: prevents same-tab stampedes when multiple UI actions refresh state at once.
  // It does not cache completed state and does not alter backend authority.
  if (!window.__novaStateFetchGuardInstalled && window.fetch) {
    window.__novaStateFetchGuardInstalled = true;
    const originalFetch = window.fetch.bind(window);
    const inflight = new Map();
    window.fetch = function novaGuardedFetch(input, init){
      try {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        const method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
        const isState = method === 'GET' && /\/api\/state(?:\?|$)/.test(url);
        if (isState) {
          const key = url;
          if (inflight.has(key)) {
            return inflight.get(key).then(function(resp){ return resp.clone(); });
          }
          const p = originalFetch(input, init).finally(function(){ inflight.delete(key); });
          inflight.set(key, p);
          return p.then(function(resp){ return resp.clone(); });
        }
      } catch (err) {}
      return originalFetch(input, init);
    };
  }

  const STORAGE_KEY = 'novaStarterTutorialDoneV1';
  const COLLAPSED_KEY = 'novaStarterTutorialMinimizedV1';
  const steps = [
    {
      title: 'Start with your ship and location',
      body: 'Open the map first. Your goal at the start is simple: know where your ship is, what planet you are docked at, and what nearby objects can be reached safely.',
      route: '#map',
      action: 'Open Map'
    },
    {
      title: 'Travel before fighting',
      body: 'Use the map to move between planets or nearby targets. Travel should show a path immediately, then the server confirms the real position. Avoid attacking while learning movement.',
      route: '#map',
      action: 'Stay on Map'
    },
    {
      title: 'Dock, repair, and use local services',
      body: 'Docked planets are your safe state. Use them for repair, market actions, crafting, and missions. Inventory and ships should be treated as local to planets; only gold is global.',
      route: '#missions',
      action: 'View Missions'
    },
    {
      title: 'Do starter missions for direction',
      body: 'Run simple missions before roaming. They teach movement, rewards, cooldowns, and planet-based storage without forcing every system onto the player at once.',
      route: '#missions',
      action: 'View Missions'
    },
    {
      title: 'Learn combat after you can travel',
      body: 'Combat uses attack energy. Manual actions are best while learning. Auto battle is for cleanup fights after you understand shields, hull, buffs, and cooldowns.',
      route: '#map',
      action: 'Return to Map'
    },
    {
      title: 'Use chat and messages only when needed',
      body: 'Global, faction, and guild chat are lightweight and should stream only when open. Direct messages belong on the messages page.',
      route: '#messages',
      action: 'Open Messages'
    }
  ];

  let index = 0;
  let root = null;

  function goRoute(route) {
    if (!route) return;
    if (window.location.hash !== route) window.location.hash = route;
  }

  function finish() {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch (err) {}
    if (root) root.remove();
    root = null;
    ensureLauncher();
  }

  function minimize() {
    try { localStorage.setItem(COLLAPSED_KEY, '1'); } catch (err) {}
    if (root) root.remove();
    root = null;
    ensureLauncher();
  }

  function render() {
    if (!root) {
      root = document.createElement('div');
      root.className = 'novaTutorialOverlay';
      document.body.appendChild(root);
    }
    const step = steps[index] || steps[0];
    root.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'novaTutorialCard';
    card.innerHTML = `
      <div class="novaTutorialTopline">
        <span>Getting Started</span>
        <span>${index + 1} / ${steps.length}</span>
      </div>
      <h2>${step.title}</h2>
      <p>${step.body}</p>
      <div class="novaTutorialProgress"><span style="width:${((index + 1) / steps.length) * 100}%"></span></div>
      <div class="novaTutorialActions">
        <button type="button" data-role="back" ${index === 0 ? 'disabled' : ''}>Back</button>
        <button type="button" data-role="route">${step.action || 'Go'}</button>
        <button type="button" data-role="next">${index === steps.length - 1 ? 'Done' : 'Next'}</button>
      </div>
      <button type="button" class="novaTutorialMinimize" data-role="minimize">Minimize</button>
    `;
    root.appendChild(card);
    card.addEventListener('click', function(evt){
      const btn = evt.target.closest('button');
      if (!btn) return;
      const role = btn.getAttribute('data-role');
      if (role === 'back') { index = Math.max(0, index - 1); render(); }
      if (role === 'route') { goRoute(step.route); }
      if (role === 'next') {
        if (index >= steps.length - 1) finish();
        else { index += 1; render(); }
      }
      if (role === 'minimize') minimize();
    });
  }

  function start(force) {
    try { localStorage.removeItem(COLLAPSED_KEY); } catch (err) {}
    if (force) {
      try { localStorage.removeItem(STORAGE_KEY); } catch (err) {}
    }
    const launcher = document.querySelector('.novaTutorialLauncher');
    if (launcher) launcher.remove();
    index = 0;
    render();
  }

  function ensureLauncher() {
    if (document.querySelector('.novaTutorialLauncher')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'novaTutorialLauncher';
    btn.textContent = 'Tutorial';
    btn.title = 'Open the getting-started guide';
    btn.addEventListener('click', function(){ start(true); });
    document.body.appendChild(btn);
  }

  function boot() {
    ensureLauncher();
    let done = false;
    let minimized = false;
    try {
      done = localStorage.getItem(STORAGE_KEY) === '1';
      minimized = localStorage.getItem(COLLAPSED_KEY) === '1';
    } catch (err) {}
    if (!done && !minimized) {
      window.setTimeout(function(){ start(false); }, 650);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
'''

    # Module-safe: append near EOF. No JSX parsing required.
    text = text.rstrip() + '\n' + block + '\n'
    write_if_changed(FRONTEND, original, text, 'frontend/src/main.jsx')


def patch_css() -> None:
    text = read_text(CSS)
    original = text
    if CSS_MARKER in text:
        skipped.append('frontend/src/styles.css: tutorial CSS marker already present')
        return

    block = r'''

/* NOVA_STARTER_TUTORIAL_CSS_V1 */
.novaTutorialOverlay {
  position: fixed;
  inset: 0;
  z-index: 2147482500;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  background: radial-gradient(circle at center, rgba(50, 120, 180, 0.10), rgba(0, 0, 0, 0.18));
}

.novaTutorialCard {
  pointer-events: auto;
  width: min(520px, calc(100vw - 34px));
  border: 1px solid rgba(130, 230, 255, 0.32);
  border-radius: 22px;
  background: rgba(6, 12, 24, 0.88);
  color: #eefbff;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.62), inset 0 1px 0 rgba(255,255,255,0.08);
  backdrop-filter: blur(16px);
  padding: 22px;
}

.novaTutorialTopline {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  color: rgba(190, 240, 255, 0.78);
  font-size: 0.74rem;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.novaTutorialCard h2 {
  margin: 0 0 10px;
  font-size: clamp(1.35rem, 3vw, 2rem);
  line-height: 1.08;
}

.novaTutorialCard p {
  margin: 0;
  color: rgba(236, 249, 255, 0.82);
  font-size: 0.98rem;
  line-height: 1.55;
}

.novaTutorialProgress {
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.08);
  margin: 18px 0;
}

.novaTutorialProgress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, rgba(86, 231, 255, 0.95), rgba(111, 255, 173, 0.9));
  transition: width 180ms ease;
}

.novaTutorialActions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.novaTutorialActions button,
.novaTutorialMinimize,
.novaTutorialLauncher {
  border: 1px solid rgba(130, 230, 255, 0.30);
  border-radius: 999px;
  background: rgba(11, 26, 47, 0.92);
  color: #effcff;
  font-weight: 900;
  letter-spacing: 0.04em;
  padding: 10px 14px;
  cursor: pointer;
}

.novaTutorialActions button[data-role="next"],
.novaTutorialActions button[data-role="route"] {
  background: linear-gradient(135deg, rgba(16, 90, 130, 0.95), rgba(12, 64, 55, 0.95));
}

.novaTutorialActions button:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}

.novaTutorialMinimize {
  margin-top: 12px;
  opacity: 0.78;
  font-size: 0.78rem;
  padding: 8px 12px;
}

.novaTutorialLauncher {
  position: fixed;
  right: 92px;
  bottom: 18px;
  z-index: 2147482000;
  background: rgba(7, 18, 32, 0.82);
  box-shadow: 0 12px 34px rgba(0,0,0,0.34);
  backdrop-filter: blur(10px);
}

@media (max-width: 720px) {
  .novaTutorialLauncher {
    right: 16px;
    bottom: 82px;
  }
  .novaTutorialCard {
    align-self: flex-end;
    margin-bottom: 18px;
  }
}
'''
    text = text.rstrip() + '\n' + block + '\n'
    write_if_changed(CSS, original, text, 'frontend/src/styles.css')


def write_roadmap() -> None:
    old = ROADMAP.read_text(encoding='utf-8') if ROADMAP.exists() else None
    if old and ROADMAP_MARKER in old:
        skipped.append('NOVA_FRONTIERS_NEXT_PASS_RECOMMENDATIONS.md: marker already present')
        return
    text = f'''# Nova Frontiers Next Pass Recommendations

{ROADMAP_MARKER}

## What this pass changed

This pass is intentionally conservative. It focuses on making the game workable for a small browser-MMO test target around 100 concurrent users without rewriting core gameplay.

Implemented by this updater:

- SQLite startup hardening: WAL mode, busy timeout, synchronous NORMAL, memory temp store, foreign keys enabled.
- Common read-path indexes for players, ships, cargo, inventory, planets, travel, battles, chat, messages, and events when those tables/columns exist.
- Same-tab `/api/state` in-flight request de-duping on the frontend.
- First-run guided tutorial overlay focused on getting started instead of explaining every system.
- Persistent tutorial launcher button so the guide can be reopened.

## Near-term work that should be done next

1. Split `/api/state` into smaller payloads.
   - Keep `/api/state` for boot/login.
   - Add `/api/state/map`, `/api/state/player`, `/api/state/battle`, `/api/state/inventory`, `/api/state/social`.
   - Poll only the slice needed by the current page.

2. Remove social/profile payloads from the hot state path.
   - The previous bottleneck notes showed `build_state` calling `public_profile_payload` around 80 times per poll, causing hundreds of SQL queries.
   - Social feed/profile summaries should have a dedicated endpoint with pagination and caching.

3. Move NPC simulation to server ticks instead of user-triggered state builds.
   - State reads should read state.
   - NPC movement, faction wars, events, and economy changes should run from a scheduled tick endpoint/process.

4. Add server-side action idempotency.
   - Every action POST should accept a client action id.
   - Duplicate action ids should return the original result.
   - This prevents double-clicks, retries, and lag from duplicating travel/combat/crafting actions.

5. Keep chat streaming/polling isolated.
   - Chat should stay closed by default.
   - Poll only while open.
   - Keep the last 100 messages per scope.

## Features worth adding later

- Starter quest chain: first travel, first dock, first mining mission, first craft, first battle, first market sale.
- Fleet roles: escort, hauler, miner, scout, pirate hunter.
- Faction control bonuses: tax discounts, repair bonuses, market advantages, special missions.
- Player contracts: hauling, bounty, escort, mining order, crafted gear order.
- Guild stations: expensive shared projects with limited services at first.
- Seasonal server events: alien raid, wormhole control, convoy defense, pirate siege.
- Salvage ownership timers: winner gets priority, then public after a delay.
- Simple auction house by planet or faction hub, not global.
- Map heat overlays: danger, faction control, trade demand, active battles.

## Things to remove or reduce

- Remove heavy public profile/social data from default state responses.
- Remove NPC action logs from normal player state. Keep admin-only simulation summaries.
- Remove always-on chat polling.
- Remove any map animation that requires full state refresh before visual feedback.
- Reduce nav clutter. Keep core nav: Map, Ship, Inventory, Missions, Market, Crafting, Messages, Events, Admin.
- Hide advanced systems until the player has completed starter tutorial steps.
- Avoid global storage except gold. Materials, items, cargo, and ships should remain planet/location-bound.

## 100-user test checklist

- Open 100 browser sessions or scripted clients.
- Poll `/api/state` no faster than every 3-5 seconds per active page.
- Do not poll hidden pages.
- Verify one action click does not trigger multiple state reloads.
- Verify chat closed means zero chat polling.
- Verify average `/api/state` response remains under 250ms on warm cache.
- Verify SQLite write locks do not produce user-visible failures under combat/travel/chat load.
- Verify action POST endpoints return quickly and frontend animates optimistically when safe.
'''
    write_if_changed(ROADMAP, old, text, 'NOVA_FRONTIERS_NEXT_PASS_RECOMMENDATIONS.md')


def main() -> None:
    print('Nova Frontiers MMO workable + starter tutorial pass')
    print(f'Project root: {ROOT}')
    patch_backend()
    patch_frontend()
    patch_css()
    write_roadmap()

    print('\nChanged:')
    for item in changed:
        print(f'  - {item}')
    if not changed:
        print('  - none')
    if skipped:
        print('\nSkipped / already present:')
        for item in skipped:
            print(f'  - {item}')
    print('\nBackups were written beside changed files with .bak-' + STAMP)


if __name__ == '__main__':
    main()
