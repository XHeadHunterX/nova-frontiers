# Nova Frontiers UI / Brand / Asset Pass

## Changed files

- `frontend/src/main.jsx`
  - Added branded Nova Frontiers logo component.
  - Added faction identity strip on login.
  - Added topbar brand emblem.
  - Wired map ship markers to generated faction/class ship assets.
  - Added visible ship/player level pills under map ship circles.
  - Added war-target visual marker support for traffic ships with war-related flags/status text.
  - Switched game images to lazy/async image loading.

- `frontend/src/styles.css`
  - Added premium sci-fi glass/HUD theme overrides.
  - Added deep-space background treatment.
  - Added modern login, sidebar, topbar, panel, button, form, map, battle, and marker styling.
  - Added pulsing orange/red war-ring styling and crossed-swords badge styling.
  - Added map level-pill styling.

- `frontend/src/assets/gameAssets.js`
  - Added brand asset exports.
  - Added faction asset manifest for Helios Dominion, Varn Collective, Nyx Syndicate, and Neutral Coalition.
  - Added generated ship class manifest.
  - Added faction/class-aware ship asset resolution.

- `frontend/index.html`
  - Added Nova Frontiers SVG favicon.

## New asset files

- `frontend/src/assets/brand/`
  - `nova-frontiers-logo.svg`
  - `nova-frontiers-emblem.svg`
  - `favicon.svg`

- `frontend/src/assets/backgrounds/`
  - `starfield.svg`

- `frontend/src/assets/factions/`
  - Unique emblem and 3 avatars each for Helios, Varn, Nyx, and Neutral.

- `frontend/src/assets/ships/`
  - Unique faction combat variants for fighter, frigate, cruiser, and battleship.
  - Unique neutral ship classes for scout, fighter, interceptor, frigate, destroyer, cruiser, battleship, carrier, freighter, mining, salvage, and civilian.
  - Special pirate and alien ship assets.

## Notes

- Assets are procedural SVGs: lightweight, transparent-background capable, and Vite-friendly.
- No backend state schema or `/api/state` payload changes were made.
- Full Vite build was not completed inside this extracted workspace because the uploaded minimal zip did not include a usable Vite binary in `node_modules/.bin`.
