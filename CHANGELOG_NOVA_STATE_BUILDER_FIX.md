# Nova Frontiers State Builder Fix

## Changed
- `backend/app/main.py`

## Fix
- Restored the missing `build_state(conn, user, player)` function wrapper around the existing full-state payload construction block.
- `/api/state` now resolves to the project’s existing state payload builder instead of crashing with `NameError: name 'build_state' is not defined`.
- Updated the admin state debug helper so it no longer calls `build_state()` with missing arguments.

## Scope
- Backend-only hotfix.
- No database schema changes.
- No frontend changes.
- No gameplay balance changes.
- No `/api/state` payload additions beyond restoring the existing intended payload.
