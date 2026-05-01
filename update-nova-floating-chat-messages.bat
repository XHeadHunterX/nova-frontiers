@echo off
setlocal
cd /d "%~dp0"

if not exist "backend\app\main.py" (
  echo ERROR: Run this from the Nova Frontiers project root. backend\app\main.py was not found.
  exit /b 1
)
if not exist "frontend\src\main.jsx" (
  echo ERROR: Run this from the Nova Frontiers project root. frontend\src\main.jsx was not found.
  exit /b 1
)
if not exist "frontend\src\styles.css" (
  echo ERROR: Run this from the Nova Frontiers project root. frontend\src\styles.css was not found.
  exit /b 1
)

python apply_nova_floating_chat_messages_patch.py
if errorlevel 1 exit /b 1

echo.
echo Patch applied. Restart backend and frontend.
