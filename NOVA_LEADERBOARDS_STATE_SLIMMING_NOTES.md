# Nova Frontiers Leaderboards + State Slimming Notes

This pass adds snapshot-based player leaderboards and moves the system toward a smaller MMO-safe hot state loop.

## Added

- `leaderboard_metric_definitions`
- `player_metric_events`
- `player_metric_daily_rollups`
- `leaderboard_snapshots`
- `leaderboard_snapshot_rows`
- `leaderboard_refresh_jobs`
- `maintenance_jobs`
- `nova_state_versions`
- `leaderboard_settings`

## Main backend hook

```python
record_player_metric(conn, player_id, metric_key, amount, faction_id=None, guild_id=None, planet_id=None, metadata=None)
```

Only call it from validated server-side gameplay actions. Do not expose a client endpoint that accepts arbitrary metric values.

## Snapshot model

Leaderboards are generated into snapshot rows. `/api/state` only gets version and flag data. Full rows are fetched by `/api/leaderboards` only when the leaderboard panel/page is open.

## State slimming

The patch adds:

```json
state_versions: { leaderboards, guild_summary, chat_global, chat_faction, messages_unread, market_summary, events_summary, profile, achievements, admin_alerts }
state_flags: { has_unread_messages, has_active_battle, has_active_war, has_pending_guild_invite, guild_data_stale, leaderboards_stale, event_page_stale }
```

By default it removes only known non-core leaderboard/admin/history payload names if they exist. Set this environment variable for stricter slimming after the frontend is moved to dedicated endpoints:

```bash
NOVA_STRICT_STATE_SLIMMING=1
```

Strict mode also defers broader sections such as public profiles, achievements, events, market, guild, and messages. Enable only after testing the relevant pages.

## Cadence

- Leaderboards: daily by default.
- Weekly/all-time snapshots: regenerated daily.
- Market/faction summaries: intended hourly.
- NPC/security/event/stale cleanup: intended 5–15 minutes.

The included maintenance guard runs at most one lightweight job per minute and skips `/api/state` requests. Long-term, move maintenance into a worker process.

## Manual refresh

Admins can refresh selected leaderboards through:

```http
POST /api/admin/leaderboards/refresh
```

## Dedicated endpoints

- `GET /api/leaderboards/summary`
- `GET /api/leaderboards`
- `GET /api/leaderboards/player`
- `POST /api/admin/leaderboards/refresh`
- `POST /api/admin/leaderboards/settings`
- `GET /api/admin/maintenance/jobs`
- `POST /api/admin/maintenance/run`
- `GET /api/admin/state/debug`
