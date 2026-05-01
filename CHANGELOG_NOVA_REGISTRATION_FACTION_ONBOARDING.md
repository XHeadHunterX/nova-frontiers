# Nova Frontiers registration + faction onboarding pass

## New / changed files

### backend/app/main.py
- Added public `GET /api/auth/factions` endpoint.
- Added faction balance payload with total players, online players, percent share, balance label, galaxy count, and human-readable faction guidance.
- Added `POST /api/auth/register` endpoint.
- New registration auto-approves players for now.
- New registration creates user, profile, player, starter ship, starter skills, starter trader job, faction assignment, and faction-specific starter location.
- Added optional Google login endpoint: `POST /api/auth/google`.
- Google login uses the free Google Identity Services id token flow. Runtime env needed:
  - API: `GOOGLE_CLIENT_ID`
  - Frontend: `VITE_GOOGLE_CLIENT_ID`
- Existing Google users log in directly.
- First-time Google users must choose faction/callsign first, then the account is created and linked.
- Added user table evolution columns: `email`, `google_sub`, `auth_provider`, `approved`, `last_login_at`.
- Added unique Google-sub index and email lookup index.
- Removed an existing stray non-printable character that broke Python parsing in this workspace.

### frontend/src/main.jsx
- Rebuilt login screen into `Login` / `Create Pilot` tabs.
- Added registration form with username, callsign, optional email, password, and faction selection.
- Added public faction balance load from `/api/auth/factions` before registration.
- Added faction cards showing current players, online players, percent balance, and balance label.
- Added human-readable faction choice explanation panel.
- Added optional Google Identity Services button support when `VITE_GOOGLE_CLIENT_ID` is configured.
- Added auth helper that handles login/register/google responses consistently.
- Enhanced starter tutorial with a faction-choice explanation step.
- Tutorial still opens automatically after first login because new accounts use a new player-specific tutorial key.

### frontend/src/styles.css
- Added registration/auth tab styling.
- Added faction balance card styling.
- Added faction decision explanation panel styling.
- Added Google auth block styling.
- Added responsive mobile layout for the registration screen.

## Notes
- No `/api/state` payload expansion was added for registration. Faction balance is loaded only from the auth screen.
- Google login does not require a paid provider, but it does require creating a free Google OAuth Web Client ID and setting the env vars above.
- Existing username/password login still works.
- Existing `godmode` and `pilot` quick-login buttons remain available on the login tab.
