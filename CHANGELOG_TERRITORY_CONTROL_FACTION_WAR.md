# Territory Control + Faction War Changelog

## backend/app/main.py

- Added `TERRITORY_CONTROL_BALANCE` with batched influence timing, contested/war/control thresholds, source caps, war rewards, NPC pressure, supply tiers, and anti-snowball declaration scaling.
- Added persistence tables:
  - `territory_control_state`
  - `territory_influence_queue`
  - `territory_supply_deliveries`
- Added territory helpers for state creation, influence decoding, faction owner counts, war pressure, supply tiers, reward modifiers, and local territory payloads.
- Added `queue_territory_influence()` and `process_territory_influence()` so combat, missions, trade, supply, and planet-control actions enqueue influence cheaply and resolve in background batches.
- Added anti-abuse declare scaling to `guild_planet_war_declare_cost()`:
  - higher cost as the guild/faction controls more planets
  - lower cost for losing factions based on planet-control gap
- Added territory influence hooks to:
  - completed planet missions
  - completed legal profitable commodity sales
  - PVE operations
  - real-time combat victories
  - planet control actions
- Added WAR-state reward effects:
  - credit/XP multiplier in war zones
  - rare `warfront_relic` combat drop chance in war zones
  - `war_participation_score` leaderboard metric emissions
- Added `territory_supply_delivery` action for delivering eligible materials to faction-owned planets in contested or war territory, granting local-only supply buffs.
- Added territory status into system and galaxy map payloads:
  - border markers
  - contested/war status
  - compact top influence list
  - supply tier and zone buff
  - territory war and contested counts
- Added territory war zones to `system_map.war_zones` without increasing `/api/state` action-by-action load.
- Added NPC traffic pressure for war systems and tagged faction patrols/pirates near war zones.
- Integrated guild-war legality so active guild war PvP targets skip bounty/jail penalties.
- Added `war_participation_score` to leaderboard metric definitions for daily snapshot processing.

## frontend/src/main.jsx

- Added Territory map layer toggle.
- Added faction/territory overlays for system nodes.
- Added contested, border, and WAR node labels/tooltips.
- Extended war-zone markers to include territory contested/war zones.
- Added territory war/contested counts to galaxy node labels.
- Added Planet Control war-supply panel with supply tier, zone buffs, and material delivery actions.

## frontend/src/styles.css

- Added subtle territory overlays for faction control, border systems, contested zones, and active war zones.
- Added pulsing red/orange styling for WAR map nodes and contested node emphasis.
- Added War Supply panel/card styling.

## Verification

- `python -m py_compile backend\app\main.py`
- `npm run build` from `frontend`
