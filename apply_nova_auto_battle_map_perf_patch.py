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

MARKER_BACKEND_HELPERS = '# NOVA_AUTO_BATTLE_MAP_PATCH_HELPERS_V1'
MARKER_BACKEND_CALL = '# NOVA_AUTO_BATTLE_MAP_PATCH_CALL_V1'
MARKER_FRONTEND_AUTO = 'NOVA_AUTO_BATTLE_TOGGLE_V1'
MARKER_CSS = 'NOVA_AUTO_BATTLE_MAP_PATCH_CSS_V1'

changed = []
skipped = []


def fail(msg: str) -> None:
    print(f'ERROR: {msg}', file=sys.stderr)
    sys.exit(1)


def read_text(path: Path) -> str:
    if not path.exists():
        fail(f'Missing required file: {path}')
    return path.read_text(encoding='utf-8')


def backup(path: Path) -> None:
    backup_path = path.with_suffix(path.suffix + f'.bak-{STAMP}')
    if not backup_path.exists():
        shutil.copy2(path, backup_path)


def write_if_changed(path: Path, old: str, new: str, label: str) -> None:
    if new == old:
        skipped.append(f'{label}: already current or pattern not found')
        return
    backup(path)
    path.write_text(new, encoding='utf-8', newline='')
    changed.append(label)


def patch_backend() -> None:
    text = read_text(BACKEND)
    original = text

    if MARKER_BACKEND_HELPERS not in text:
        helper_block = f'''

{MARKER_BACKEND_HELPERS}
def nova_patch_planet_distribution_xy(galaxy_code: str, index: int, total: int) -> tuple[float, float]:
    """Deterministic spread for local planet maps.

    Keeps planets away from corners while spreading them across a much larger galaxy canvas.
    Existing planets are rewritten once by nova_patch_redistribute_planets_once().
    """
    total = max(1, int(total or 1))
    index = max(0, int(index or 0))
    seed = int(hashlib.sha256(str(galaxy_code or 'galaxy').encode('utf-8')).hexdigest()[:8], 16)
    angle_offset = math.radians(seed % 360)
    golden_angle = math.pi * (3 - math.sqrt(5))
    # Stored x/y later become map percent through x/2.3 and y/2.3.
    # Max radius 64 -> about 22%..78% before any frontend spread, avoiding corner clamps.
    radius = 12.0 + (52.0 * math.sqrt((index + 0.5) / total))
    angle = angle_offset + index * golden_angle
    return round(math.cos(angle) * radius, 2), round(math.sin(angle) * radius, 2)


def nova_patch_redistribute_planets_once(conn: sqlite3.Connection) -> None:
    key = 'nova_planet_sunflower_distribution_v1'
    try:
        if row(conn, 'SELECT value FROM app_state WHERE key=?', (key,)):
            return
        galaxy_rows = rows(conn, 'SELECT id, code FROM galaxies ORDER BY id')
        for galaxy in galaxy_rows:
            planet_rows = rows(conn, 'SELECT id FROM planets WHERE galaxy_id=? ORDER BY id', (galaxy['id'],))
            total = len(planet_rows)
            for idx, planet in enumerate(planet_rows):
                x, y = nova_patch_planet_distribution_xy(str(galaxy.get('code') or galaxy.get('id')), idx, total)
                conn.execute('UPDATE planets SET x=?, y=? WHERE id=?', (x, y, planet['id']))
        conn.execute(
            'INSERT OR REPLACE INTO app_state(key,value,updated_at) VALUES(?,?,?)',
            (key, '1', iso()),
        )
    except Exception:
        # Never break /api/state if an older DB is missing a column/table.
        return
'''
        marker = 'class LoginRequest(BaseModel):'
        if marker in text:
            text = text.replace(marker, helper_block + '\n\n' + marker, 1)
        else:
            skipped.append('backend helper insert: LoginRequest marker not found')

    if MARKER_BACKEND_CALL not in text:
        pattern = re.compile(r'(def\s+build_state\s*\([^\)]*\)\s*->\s*Dict\[str,\s*Any\]\s*:\s*\n)')
        match = pattern.search(text)
        call_block = f'''\1    {MARKER_BACKEND_CALL}\n    nova_patch_redistribute_planets_once(conn)\n'''
        if match:
            text = pattern.sub(call_block, text, count=1)
        else:
            # fallback for unannotated build_state variants
            pattern2 = re.compile(r'(def\s+build_state\s*\([^\)]*\)\s*:\s*\n)')
            if pattern2.search(text):
                text = pattern2.sub(call_block, text, count=1)
            else:
                skipped.append('backend call insert: build_state marker not found')

    write_if_changed(BACKEND, original, text, 'backend/app/main.py')


def patch_frontend() -> None:
    text = read_text(FRONTEND)
    original = text

    if MARKER_FRONTEND_AUTO not in text:
        perform_pattern = re.compile(
            r'(async\s+function\s+performCombatAction\s*\(\s*action\s*,\s*extra\s*=\s*\{\}\s*\)\s*\{.*?\n\s*\}\n)',
            re.DOTALL,
        )
        auto_block = f'''
  // {MARKER_FRONTEND_AUTO}
  const [autoBattleEnabled, setAutoBattleEnabled] = useState(() => {{
    try {{ return localStorage.getItem('novaAutoBattleEnabled') === '1'; }} catch {{ return false; }}
  }});
  const autoBattleBusyRef = useRef(false);

  useEffect(() => {{
    try {{ localStorage.setItem('novaAutoBattleEnabled', autoBattleEnabled ? '1' : '0'); }} catch {{}}
  }}, [autoBattleEnabled]);

  useEffect(() => {{
    if (!autoBattleEnabled || !localBattle || complete || autoBattleBusyRef.current) return;
    if (playerActionCooldown > 0 || availableEnergy < 1) return;
    autoBattleBusyRef.current = true;
    performCombatAction('use_all').finally(() => {{
      window.setTimeout(() => {{ autoBattleBusyRef.current = false; }}, 450);
    }});
  }}, [autoBattleEnabled, localBattle?.id, localBattle?.updated_at, localBattle?.updatedAt, complete, availableEnergy, playerActionCooldown, playerEnergy, enemyEnergy]);
'''
        if perform_pattern.search(text):
            text = perform_pattern.sub(lambda m: m.group(1) + auto_block, text, count=1)
        else:
            skipped.append('frontend auto effect insert: performCombatAction marker not found')

        energy_marker = '<BattleEnergyMeter label="Your Attack Energy" value={playerEnergy} max={maxEnergy} rate={localBattle?.playerEnergyRateSeconds} />'
        if energy_marker in text:
            text = text.replace(
                energy_marker,
                energy_marker + '''
          <div className="battleAutoSlot">
            <button
              className={`autoBattleToggle ${autoBattleEnabled ? 'active' : ''}`}
              disabled={complete}
              onClick={()=>setAutoBattleEnabled(v => !v)}
              title="Automatically fires Use All when attack energy is ready."
            >
              {autoBattleEnabled ? 'AUTO BATTLE ON' : 'AUTO BATTLE'}
            </button>
          </div>''',
                1,
            )
        else:
            skipped.append('frontend auto button insert: energy meter marker not found')

    write_if_changed(FRONTEND, original, text, 'frontend/src/main.jsx')


def patch_css() -> None:
    text = read_text(CSS)
    original = text
    if MARKER_CSS not in text:
        text += f'''

/* {MARKER_CSS} */
.battleAutoSlot {{
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
}}

.autoBattleToggle {{
  border: 1px solid rgba(112, 240, 255, 0.38);
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(13, 31, 55, 0.96), rgba(8, 13, 29, 0.96));
  color: #dffbff;
  font-weight: 900;
  letter-spacing: 0.08em;
  font-size: 0.72rem;
  padding: 10px 14px;
  box-shadow: 0 0 0 1px rgba(255,255,255,0.05), 0 10px 24px rgba(0,0,0,0.28);
  cursor: pointer;
  white-space: nowrap;
}}

.autoBattleToggle.active {{
  border-color: rgba(117, 255, 174, 0.76);
  background: linear-gradient(135deg, rgba(23, 96, 68, 0.98), rgba(5, 44, 38, 0.98));
  color: #ecfff5;
  box-shadow: 0 0 20px rgba(79, 255, 167, 0.28), 0 10px 24px rgba(0,0,0,0.28);
}}

.autoBattleToggle:disabled {{
  opacity: 0.45;
  cursor: not-allowed;
}}

.mapViewport {{
  overflow: auto;
}}

.infoMap.galaxyMap.openWorldMap.mapWorld {{
  width: 3600px !important;
  height: 2400px !important;
  min-width: 3600px !important;
  min-height: 2400px !important;
}}

.galaxyMap .mapNode {{
  transition: left 180ms ease, top 180ms ease, transform 140ms ease, filter 140ms ease;
}}

.galaxyMap .mapLines {{
  width: 100%;
  height: 100%;
}}
'''
    write_if_changed(CSS, original, text, 'frontend/src/styles.css')


def main() -> None:
    print('Nova Frontiers auto-battle + galaxy map patch')
    print(f'Project root: {ROOT}')
    patch_backend()
    patch_frontend()
    patch_css()
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
