@echo off
setlocal
cd /d "%~dp0"

if not exist "backend\app\main.py" (
  echo ERROR: Run this from the Nova Frontiers project root. backend\app\main.py was not found.
  pause
  exit /b 1
)

python apply_nova_security_defense_system_patch.py
if errorlevel 1 (
  echo.
  echo Patch failed.
  pause
  exit /b 1
)

echo.
echo Patch complete.
echo Restart backend and frontend.
echo Then run: python -m py_compile backend\app\main.py
echo Then run: cd frontend ^&^& npm run build
pause
