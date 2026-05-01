@echo off
setlocal
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python was not found on PATH.
  echo Install Python or run: py apply_nova_guild_rewrite_foundation_patch.py
  pause
  exit /b 1
)
python apply_nova_guild_rewrite_foundation_patch.py
if errorlevel 1 (
  echo Patch failed.
  pause
  exit /b 1
)
echo.
echo Patch applied. Restart backend and frontend.
echo Recommended checks:
echo   python -m py_compile backend\app\main.py
echo   cd frontend ^&^& npm run build
pause
