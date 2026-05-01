# Nova Frontiers Tutorial Replay Pass

Changed files only.

## frontend/src/main.jsx

### App
- Added a logged-in player tutorial identity event.
- Tutorial first-run storage now keys off the loaded player/user identity instead of one browser-global flag.
- Added `nova:set-page` event handling so tutorial route buttons can switch the React page instead of only changing the URL hash.

### Topbar
- Added a visible `View Tutorial` button beside the logout controls.
- Button dispatches `nova:tutorial-open` and does not touch save data, API state, or backend logic.

### novaStarterTutorialAndFetchGuard
- Replaced tutorial guard V1 with V2.
- Tutorial now waits until the logged-in app shell and player identity are available.
- Tutorial opens automatically for a player's first login on that browser.
- Tutorial completion is stored per player under `novaStarterTutorialDoneV2:<player>`.
- `Not now` only suppresses the tutorial for the current browser session, so an unfinished tutorial can appear again later.
- Floating launcher text changed from `Tutorial` to `View Tutorial`.
- Tutorial copy was rewritten to sound more like practical player guidance.
- Existing `/api/state` fetch de-dupe behavior was preserved.

## frontend/src/styles.css

### NOVA_TUTORIAL_REPLAY_CSS_V1
- Added styling for the new topbar `View Tutorial` button.
- Improved replay launcher width/readability.
- Slightly tightened tutorial card styling to match the newer sci-fi UI pass.

## Notes
- No backend files changed.
- No `/api/state` payload fields were added.
- No gameplay logic was changed.
