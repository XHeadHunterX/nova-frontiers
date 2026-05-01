@echo off
setlocal
cd /d "%~dp0"
if not exist backend\app\main.py (
  echo ERROR: Run this from the Nova Frontiers project root. Missing backend\app\main.py
  pause
  exit /b 1
)
if not exist frontend\src\main.jsx (
  echo ERROR: Missing frontend\src\main.jsx
  pause
  exit /b 1
)
if not exist frontend\src\styles.css (
  echo ERROR: Missing frontend\src\styles.css
  pause
  exit /b 1
)
python apply_nova_leaderboards_state_slimming_patch.py
if errorlevel 1 (
  echo Patch failed.
  pause
  exit /b 1
)
echo.
echo Patch applied. Recommended checks:
echo   python -m py_compile backend\app\main.py
echo   cd frontend ^&^& npm run build
echo.
pause
