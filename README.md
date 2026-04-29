# Nova Frontiers — Phase 22 Map / Live Travel Recovery Build

This is a regenerated replacement package for `nova-frontiers-phase22-map-live-travel.zip`.

It is a dependency-light local prototype: Python serves both the API and the frontend. No FastAPI, Pydantic, Vite, npm, or node_modules are required.

## Run on Windows

Double-click:

```bat
run-nova-frontiers-phase22.bat
```

Then open:

```txt
http://127.0.0.1:8000
```

## Run on macOS / Linux

```bash
chmod +x run-dev.sh
./run-dev.sh
```

## Accounts

The login screen accepts any callsign/password. Use these defaults:

```txt
godmode / godmode123
pilot / pilot123
```

God mode starts with more credits and faster operations.

## Implemented Phase 22 targets

- Larger open-world map viewport.
- Mouse drag / pan.
- Zoom in, zoom out, reset view.
- Context popup to the right of mouse click.
- No immediate map actions on first click.
- Live player travel interpolation.
- Live NPC travel interpolation.
- Timed cargo loading and offloading.
- Travel blocked during cargo operations.
- Player cannot be attacked while loading or offloading.
- Security response by local security level.
- NPC travel, trading, mining, patrol, pirate, and hauler behavior.
- Natural ore signatures and salvage wrecks.
- 0 salvage / 0 ore outcomes remain possible.
- Markets move through NPC activity and player actions.
- Backend authoritative timestamps for travel and cargo timers.
- No external services.

## File layout

```txt
backend/server.py                 Python stdlib API/static server
frontend/index.html               Browser app shell
frontend/app.js                   Map/UI logic
frontend/styles.css               Layout and map styling
run-nova-frontiers-phase22.bat     Windows launcher
run-dev.sh                        macOS/Linux launcher
PHASE22_SPEC.md                   Regenerated implementation spec
```

## Reset state

Delete:

```txt
backend/data/state.json
```

The server rebuilds a fresh universe on next launch.
