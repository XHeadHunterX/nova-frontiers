# Google Auth and Profile Deletion

## Changed Files

- `backend/app/main.py`
- `frontend/src/main.jsx`
- `frontend/src/styles.css`
- `frontend/dist/index.html`
- `frontend/dist/assets/index-CEIc6gi3.css`
- `frontend/dist/assets/index-oNpH1VhR.js`
- `CHANGELOG_GOOGLE_AUTH_PROFILE_DELETE.md`

## Backend

- Split Google login into linked-account login only at `POST /api/auth/google/login`.
- Kept `POST /api/auth/google` as a compatibility alias without auto-creating accounts.
- Added `POST /api/auth/google/register-start` for temporary pending Google registration identity.
- Updated `POST /api/auth/register` to link pending Google identity only after account creation succeeds.
- Added `POST /api/auth/logout`, `POST /api/auth/google/clear`, and `DELETE /api/profile/delete`.
- Added pending Google registration storage and user Google link metadata (`google_email`, `google_linked_at`).
- Hardened Google token checks for issuer, audience, expiration, and verified email.
- Added transaction-backed own-profile deletion with typed `DELETE` confirmation.

## Frontend

- Login Google flow now reports unknown accounts as “No account found. Please register first.” and clears Google state.
- Registration Google flow starts a pending link, pre-fills Google email, and links only when `Create Account` succeeds.
- Logout/session-expiration paths clear Nova token storage and Google client state.
- Profile page now includes a dangerous delete flow with modal and exact `DELETE` confirmation.

## Verification

- `python -m py_compile backend/app/main.py`
- `npm run build`
- Direct backend auth-flow check with mocked Google verifier:
  - unknown Google login rejected
  - register-start creates pending identity
  - registration links Google identity
  - linked Google login succeeds
  - profile deletion requires exact `DELETE`
  - deleted profile cannot log in by Google

`fastapi.testclient.TestClient` was not used because the local backend venv is missing `httpx`.
