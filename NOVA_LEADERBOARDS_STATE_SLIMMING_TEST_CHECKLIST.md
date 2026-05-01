# Nova Leaderboards + State Slimming Test Checklist

## Backend

- Start backend without syntax errors.
- Hit `GET /api/leaderboards/summary`.
- Confirm metric definitions are seeded.
- Call `record_player_metric(conn, player_id, 'resources_mined', 10)` from a safe dev console/test route.
- Confirm `player_metric_events` inserts.
- Confirm `player_metric_daily_rollups` increments.
- Hit `POST /api/admin/leaderboards/refresh` as admin.
- Confirm snapshot row creation.
- Confirm `GET /api/leaderboards?metric_key=resources_mined&scope=global&period=daily` returns rows.
- Confirm faction scope works with `scope=faction`.
- Confirm non-admin cannot call admin refresh.
- Confirm failed leaderboard writes do not break gameplay actions.

## Frontend

- Open Leaderboards.
- Switch Global/Faction.
- Switch category.
- Switch metric.
- Switch period.
- Confirm current player row highlights if present.
- Confirm admin manual refresh button appears only for admins.
- Confirm leaderboards do not poll every state tick.

## State Payload

- Confirm `/api/state` includes `state_versions`.
- Confirm `/api/state` includes `state_flags`.
- Confirm `/api/state` does not include full leaderboard rows.
- Use `/api/admin/state/debug` to identify largest remaining sections.
- Enable `NOVA_STRICT_STATE_SLIMMING=1` only after dedicated page endpoints are verified.

## 100-user MMO check

- Simulate many `/api/state` polls.
- Confirm no leaderboard snapshot generation occurs from state calls.
- Confirm maintenance does not run more than one guarded job per minute.
- Confirm opening leaderboard page does not rebuild all metrics.
