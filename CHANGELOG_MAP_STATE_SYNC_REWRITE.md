# Map State Sync Rewrite Changelog

## Backend

- `backend/app/main.py`
  - Added `/api/map/snapshot` as the lightweight initial map snapshot endpoint.
  - Added `/api/map/delta` as the lightweight map delta endpoint, with backward-compatible `/api/state/map` and `/api/state/map/ping` routes still available.
  - Updated `build_map_state_snapshot` to return player core state, location, active travel, active battle summary, local/galaxy map data, version, timestamp, priority, group hashes, and recommended polling cadence.
  - Updated `state_map_ping` to accept `lastKnownVersion`, compare client/server map versions, return only changed map groups, and request a resync when the client lacks a usable version/hash baseline.
  - Added map sync helpers:
    - `build_map_player_core`
    - `build_map_location_core`
    - `build_map_active_battle_summary`
    - `map_sync_priority`
  - Expanded `MAP_DELTA_TOP_LEVEL_KEYS` so player core, location, travel state, battle state, map operations, and planet missions can delta independently.
  - Added per-player, per-action server cooldowns through `ACTION_COOLDOWN_SECONDS`, `action_cooldown_seconds`, and `enforce_action_cooldown`.
  - Extended `ensure_action_allowed` so nonce cleanup and action cooldown checks run inside the authoritative action transaction.
  - Added `run_background_world_tick` and moved heavy maintenance into the background simulation loop:
    - NPC simulation
    - server world control
    - server events
    - faction war resolution
    - territory influence
    - guild planet XP bonuses
  - Reduced `/api/state` and `/api/action` hot-path work by removing repeated market/event/territory maintenance from regular state refreshes and action commands.
  - Changed `process_planet_faction_wars` to support lightweight player-presence refreshes without resolving every global war on each state request.

## Frontend

- `frontend/src/main.jsx`
  - Changed map slice loading from `/api/state/map` to `/api/map/snapshot`.
  - Changed map polling from `/api/state/map/ping` to `/api/map/delta`.
  - Added `lastKnownVersion` support for map delta requests.
  - Added resync handling when the server returns `resyncRequired`.
  - Updated map version handling to prefer `map_snapshot.version` while preserving existing revision aliases.
  - Added client-side map polling cadence selection via `mapPollingCadenceMs`:
    - combat: 750-1500ms
    - active map: 2500-5000ms
    - docked/menu: 8000-15000ms
    - background tab: 30000ms
  - Added browser visibility tracking so background tabs slow down instead of polling at foreground cadence.
  - Added TTL checks to map delta polling to avoid redundant concurrent refreshes.
  - Extended map delta merging to preserve and update player core state, location, active battle state, travel state, and only changed map groups.
  - Added default in-flight action dedupe keys so duplicate pending commands are ignored in the UI while the server remains authoritative.

## Architecture Result

- The server remains authoritative for inventory, economy, combat, movement truth, rewards, safety, and exploit-sensitive validation.
- The client now owns low-risk map presentation, polling cadence, visual travel feedback, version tracking, and merging changed map groups without reloading the full app.
- Heavy world systems advance through background ticks instead of being recalculated on every player state request.
