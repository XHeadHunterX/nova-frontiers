# Nova Frontiers Deployment Notes

## Current Render Mode

The existing Render web service remains supported. Keep the current start command:

```bash
cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

No Redis, R2, S3, worker, or new required environment variable is needed. If `REDIS_URL` is absent, runtime locks, presence, rate limits, and WebSocket broadcast use the current single-instance in-memory behavior. If object storage variables are absent, local storage is used.

## Future Fly.io/API Mode

Run the API as a normal ASGI service:

```bash
cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8080
```

Recommended optional variables:

```bash
PLATFORM_MODE=fly
PUBLIC_GAME_URL=https://novafrontiersgame.com
API_BASE_URL=https://api.novafrontiersgame.com
WS_BASE_URL=wss://api.novafrontiersgame.com
CORS_ALLOWED_ORIGINS=https://novafrontiersgame.com,https://www.novafrontiersgame.com
REDIS_URL=redis://...
WORKER_ENABLED=true
```

Set `WORKER_ENABLED=true` on API instances only when a separate worker process is deployed. With the variable missing or false, the API keeps the Render-compatible in-process background loop.

## Worker Process

The worker is optional and starts only when explicitly run:

```bash
cd backend && python -m app.worker
```

For one-shot verification:

```bash
cd backend && WORKER_RUN_ONCE=1 python -m app.worker
```

Worker jobs cover NPC simulation, server events, leaderboard refresh, cleanup, and economy maintenance. Jobs are idempotent and use Redis locks when available; without Redis they use safe single-instance in-memory locks.

## Redis

Set `REDIS_URL` to enable shared runtime locks, cooldown locks, rate limits, worker locks, presence, and WebSocket pub/sub preparation. Redis never becomes the source of truth for player progression, economy, combat, inventory, subscriptions, or payments.

If Redis is unavailable at boot, the API logs a warning and falls back to in-memory behavior.

## R2/S3

Local storage is the default. To prepare R2:

```bash
OBJECT_STORAGE_PROVIDER=r2
R2_BUCKET=nova-frontiers
R2_ENDPOINT=https://accountid.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
```

To prepare S3:

```bash
OBJECT_STORAGE_PROVIDER=s3
S3_BUCKET=nova-frontiers
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
```

If object storage is incomplete or unavailable, the API logs a warning and uses local storage. Public assets can remain public; private/generated files now have a storage adapter path for signed URLs later.

## Environment Variables

Current variables remain compatible, including `NOVA_DB`, `NOVA_CORS_ORIGINS`, `NOVA_DEV`, and existing tuning variables.

New optional variables:

`REDIS_URL`, `OBJECT_STORAGE_PROVIDER`, `R2_BUCKET`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `PUBLIC_GAME_URL`, `API_BASE_URL`, `WS_BASE_URL`, `CORS_ALLOWED_ORIGINS`, `WORKER_ENABLED`, `PLATFORM_MODE`, `SLOW_REQUEST_LOG_MS`.

## Migrations

Startup applies the additive final-stack schema automatically through `migrate()`. The equivalent migration file is:

```txt
backend/app/migrations/001_final_stack_prep.sql
```

It only creates new tables/indexes and does not drop, rename, delete, require backfill, or make existing nullable columns required.

## Rollback

To rollback the code, redeploy the previous Render release. The new tables and indexes are additive and can safely remain in the database. If an emergency manual rollback is required, pause worker processes first, then roll back the API. Do not delete subscription/payment audit tables unless you have exported them.

## Diagnostics

Health:

```txt
/api/health
```

Readiness:

```txt
/api/readiness
```

WebSocket:

```txt
/ws
/api/ws
```

Logs include slow API requests, Redis fallback, storage adapter mode, worker job results, and WebSocket connect/disconnect events without logging every simulation tick.
