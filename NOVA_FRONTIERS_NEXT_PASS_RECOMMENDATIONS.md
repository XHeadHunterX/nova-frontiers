# Nova Frontiers Next Pass Recommendations

NOVA_FRONTIERS_NEXT_PASS_RECOMMENDATIONS_V1

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
