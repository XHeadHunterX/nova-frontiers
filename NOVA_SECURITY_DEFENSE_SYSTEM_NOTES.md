# NOVA_SECURITY_DEFENSE_SYSTEM_NOTES_V1

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
{
  "turret_respawn_seconds": 600,
  "turret_escalation_quiet_seconds": 3600,
  "turret_range_multiplier": 3,
  "max_turret_multiplier": 8,
  "patrol_respawn_seconds": 420,
  "patrol_escalation_quiet_seconds": 3600,
  "max_patrol_bonus": 6,
  "set_war_galaxy_id": "border-1",
  "set_war_active": true
}
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
python -m py_compile backendpp\main.py
cd frontend
npm run build
```
