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
if not exist "frontend\src\styles.css" (
  echo ERROR: Run this from the Nova Frontiers project root. frontend\src\styles.css was not found.
  pause
  exit /b 1
)

python apply_nova_mmo_workable_tutorial_pass.py
if errorlevel 1 (
  echo.
  echo Patch failed.
  pause
  exit /b 1
)

echo.
echo Patch complete.
echo Restart backend and frontend.
pause
