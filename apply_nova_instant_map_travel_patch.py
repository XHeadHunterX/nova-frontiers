from __future__ import annotations

import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

STAMP = datetime.now().strftime('%Y%m%d-%H%M%S')
ROOT = Path.cwd()
FRONTEND = ROOT / 'frontend' / 'src' / 'main.jsx'
MARKER = 'NOVA_INSTANT_MAP_TRAVEL_PATCH_V1'
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


def insert_helpers(text: str) -> str:
    if MARKER in text:
        return text
    helper = f'''

// {MARKER}
function novaPct(value, fallback = 50) {{
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(99, n));
}}

function novaIsoPlusSeconds(seconds) {{
  return new Date(Date.now() + Math.max(3, Number(seconds || 45)) * 1000).toISOString();
}}

function novaDistancePct(a, b) {{
  const ax = novaPct(a?.x_pct ?? a?.x, 50);
  const ay = novaPct(a?.y_pct ?? a?.y, 50);
  const bx = novaPct(b?.x_pct ?? b?.x, 50);
  const by = novaPct(b?.y_pct ?? b?.y, 50);
  return Math.hypot(bx - ax, by - ay);
}}

function novaCurrentMapPoint(state, mapType) {{
  const travel = state?.travel_state || {{}};
  const wanted = String(mapType || travel.open_space_map_type || travel.mode || 'system').toLowerCase();
  if (travel.active && travel.destination_x_pct != null && travel.destination_y_pct != null && (!travel.mode || String(travel.mode).toLowerCase() === wanted)) {{
    return {{x_pct:novaPct(travel.destination_x_pct), y_pct:novaPct(travel.destination_y_pct)}};
  }}
  if (travel.open_space && travel.open_space_x_pct != null && travel.open_space_y_pct != null && (!travel.open_space_map_type || String(travel.open_space_map_type).toLowerCase() === wanted)) {{
    return {{x_pct:novaPct(travel.open_space_x_pct), y_pct:novaPct(travel.open_space_y_pct)}};
  }}
  const map = wanted === 'galaxy' ? state?.galaxy_map : state?.system_map;
  const currentId = wanted === 'galaxy'
    ? (map?.current_galaxy_id ?? state?.location?.galaxy_id)
    : (map?.current_planet_id ?? state?.location?.planet_id);
  const node = (map?.nodes || []).find(n => n?.current || String(n?.id) === String(currentId));
  if (node) return {{x_pct:novaPct(node.x_pct), y_pct:novaPct(node.y_pct)}};
  const summary = map?.summary || {{}};
  return {{x_pct:novaPct(summary.radar_center_x_pct ?? summary.player_x_pct ?? 50), y_pct:novaPct(summary.radar_center_y_pct ?? summary.player_y_pct ?? 50)}};
}}

function novaFindMapNode(state, mapType, id) {{
  const map = String(mapType || '').toLowerCase() === 'galaxy' ? state?.galaxy_map : state?.system_map;
  return (map?.nodes || []).find(n => String(n?.id) === String(id) || String(n?.galaxy_id) === String(id) || String(n?.planet_id) === String(id)) || null;
}}

function novaOptimisticTravelState(prevState, actionType, payload) {{
  if (!prevState || !payload || typeof payload !== 'object') return null;
  const type = String(actionType || '').toLowerCase();
  const p = payload || {{}};
  let mapType = String(p.map_type || p.mapType || '').toLowerCase();
  let dest = null;
  let mode = mapType || 'system';
  let labelText = p.label || 'Waypoint';

  if (type === 'go_here' || type === 'plot_course' || type === 'set_course') {{
    mapType = mapType || String(prevState?.travel_state?.open_space_map_type || prevState?.travel_state?.mode || 'system').toLowerCase();
    mode = mapType;
    dest = {{x_pct:novaPct(p.x_pct ?? p.x ?? p.destination_x_pct), y_pct:novaPct(p.y_pct ?? p.y ?? p.destination_y_pct)}};
  }} else if (type === 'travel' && p.planet_id != null) {{
    mode = 'system';
    mapType = 'system';
    const node = novaFindMapNode(prevState, 'system', p.planet_id);
    if (!node) return null;
    dest = {{x_pct:novaPct(node.x_pct), y_pct:novaPct(node.y_pct)}};
    labelText = node.name || p.label || 'Planet';
  }} else if (type === 'galaxy_travel' && p.galaxy_id != null) {{
    mode = 'galaxy';
    mapType = 'galaxy';
    const node = novaFindMapNode(prevState, 'galaxy', p.galaxy_id);
    if (!node) return null;
    dest = {{x_pct:novaPct(node.x_pct), y_pct:novaPct(node.y_pct)}};
    labelText = node.name || p.label || 'Galaxy';
  }} else if (type === 'intercept_traveler' && (p.x_pct != null || p.target_x_pct != null)) {{
    mapType = mapType || String(prevState?.travel_state?.open_space_map_type || 'system').toLowerCase();
    mode = 'intercept';
    dest = {{x_pct:novaPct(p.x_pct ?? p.target_x_pct), y_pct:novaPct(p.y_pct ?? p.target_y_pct)}};
    labelText = p.label || p.target_name || 'Intercept target';
  }} else {{
    return null;
  }}

  if (!dest) return null;
  const origin = novaCurrentMapPoint(prevState, mapType);
  const distance = novaDistancePct(origin, dest);
  const travelSeconds = Math.max(8, Math.min(90, distance * 1.25));
  const startedAt = new Date().toISOString();
  const arrivalAt = novaIsoPlusSeconds(travelSeconds);
  const nextTravel = {{
    ...(prevState.travel_state || {{}}),
    active: true,
    open_space: false,
    mode,
    optimistic: true,
    started_at: startedAt,
    startedAt: startedAt,
    arrival_at: arrivalAt,
    arrivalAt: arrivalAt,
    origin_x_pct: origin.x_pct,
    origin_y_pct: origin.y_pct,
    destination_x_pct: dest.x_pct,
    destination_y_pct: dest.y_pct,
    destination_label: labelText,
    open_space_map_type: mapType,
  }};
  if (mapType === 'galaxy') {{
    nextTravel.origin_galaxy_id = prevState?.location?.galaxy_id ?? prevState?.galaxy_map?.current_galaxy_id;
    nextTravel.destination_galaxy_id = p.galaxy_id ?? nextTravel.destination_galaxy_id;
  }} else {{
    nextTravel.origin_planet_id = prevState?.location?.planet_id ?? prevState?.system_map?.current_planet_id;
    nextTravel.destination_planet_id = p.planet_id ?? nextTravel.destination_planet_id;
  }}
  return {{...prevState, travel_state: nextTravel}};
}}
'''
    m = re.search(r"const\s+uid\s*=\s*\(\)\s*=>.*?;", text)
    if not m:
        skipped.append('helper insert: uid marker not found')
        return text
    return text[:m.end()] + helper + text[m.end():]


def patch_act_function(text: str) -> str:
    if 'novaOptimisticTravelState(prevStateForOptimisticTravel' in text:
        return text

    # Insert optimistic state update immediately inside act(), before the network request.
    pattern = re.compile(r"(async\s+function\s+act\s*\(\s*type\s*,\s*payload\s*=\s*\{\}\s*(?:,\s*options\s*=\s*\{\}\s*)?\)\s*\{\s*\n)")
    if not pattern.search(text):
        skipped.append('act patch: act function signature not found')
        return text

    insert = r"""\1    const prevStateForOptimisticTravel = state;
    const optimisticTravelState = novaOptimisticTravelState(prevStateForOptimisticTravel, type, payload);
    if (optimisticTravelState) setState(optimisticTravelState);
"""
    text = pattern.sub(insert, text, count=1)

    # Revert only if the action fails before the server state can reconcile.
    catch_pattern = re.compile(r"(\}\s*catch\s*\(e\)\s*\{\s*\n)")
    if catch_pattern.search(text):
        text = catch_pattern.sub(r"\1      if (optimisticTravelState && prevStateForOptimisticTravel) setState(prevStateForOptimisticTravel);\n", text, count=1)
    else:
        skipped.append('act patch: catch block not found for optimistic revert')

    return text


def patch_set_state_safety(text: str) -> str:
    # Older branches call setState(data.state), which can blank the app when action responses only return refresh:true.
    if 'NOVA_ACTION_STATE_SAFETY_V1' in text:
        return text
    old = '      setState(data.state);\n'
    if old in text:
        new = '''      // NOVA_ACTION_STATE_SAFETY_V1
      if (data.state && typeof data.state === 'object') {
        setState(data.state);
      } else if (data.refresh !== false && typeof load === 'function') {
        load().catch?.(() => {});
      }
'''
        return text.replace(old, new, 1)
    skipped.append('state safety patch: setState(data.state) not found')
    return text


def patch_file() -> None:
    text = read_text(FRONTEND)
    original = text
    text = insert_helpers(text)
    text = patch_act_function(text)
    text = patch_set_state_safety(text)
    write_if_changed(FRONTEND, original, text, 'frontend/src/main.jsx')


def main() -> None:
    print('Nova Frontiers instant map travel patch')
    print(f'Project root: {ROOT}')
    patch_file()
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
