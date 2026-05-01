@echo off
setlocal
cd /d "%~dp0"

if not exist "backend\app\main.py" (
  echo ERROR: Run this from the Nova Frontiers project root. backend\app\main.py was not found.
  pause
  exit /b 1
)

if not exist "frontend\src\main.jsx" (
  echo ERROR: Run this from the Nova Frontiers project root. frontend\src\main.jsx was not found.
  pause
  exit /b 1
)

python apply_nova_auto_battle_map_perf_patch.py
if errorlevel 1 (
  echo.
  echo Patch failed.
  pause
  exit /b 1
)

echo.
echo Patch complete.
echo Restart backend/frontend.
pause
