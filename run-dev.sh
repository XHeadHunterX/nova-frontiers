#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d backend/.venv ]; then
  python3 -m venv backend/.venv
fi

backend/.venv/bin/python -m pip install --upgrade pip
backend/.venv/bin/python -m pip install -r backend/requirements.txt

if [ ! -x frontend/node_modules/.bin/vite ]; then
  (cd frontend && npm install)
fi

( cd backend && .venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 ) &
BACKEND_PID=$!

( cd frontend && npm run dev -- --host 127.0.0.1 --port 5173 ) &
FRONTEND_PID=$!

printf '\nNova Frontiers running:\nBackend:  http://127.0.0.1:8000\nFrontend: http://127.0.0.1:5173\n\n'
wait $BACKEND_PID $FRONTEND_PID
