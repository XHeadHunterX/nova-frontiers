@echo off
setlocal
cd /d "%~dp0"

if not exist "frontend\src\main.jsx" (
  echo ERROR: Run this from the Nova Frontiers project root. frontend\src\main.jsx was not found.
  pause
  exit /b 1
)

python apply_nova_instant_map_travel_patch.py
if errorlevel 1 (
  echo.
  echo Patch failed.
  pause
  exit /b 1
)

echo.
echo Patch complete.
echo Restart frontend.
echo Backend restart is not required for this client-side fix.
pause
