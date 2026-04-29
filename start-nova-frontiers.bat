@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM Nova Frontiers full local launcher
REM Put this file in the project root beside the backend and frontend folders.
REM Double-click this file to start both servers.

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo.
echo ==========================================
echo   Nova Frontiers Local Launcher
echo ==========================================
echo Root: %ROOT%
echo.

if not exist "%ROOT%backend" (
    echo ERROR: backend folder not found next to this launcher.
    pause
    exit /b 1
)

if not exist "%ROOT%frontend" (
    echo ERROR: frontend folder not found next to this launcher.
    pause
    exit /b 1
)

REM ------------------------------------------------------------
REM Python / backend setup
REM ------------------------------------------------------------
set "PYTHON_EXE=%ROOT%backend\.venv\Scripts\python.exe"

if not exist "%PYTHON_EXE%" (
    echo Backend virtual environment missing. Creating backend\.venv...
    if exist "%ROOT%backend\.venv" rmdir /s /q "%ROOT%backend\.venv"

    where py >nul 2>nul
    if not errorlevel 1 (
        py -3.12 -m venv "%ROOT%backend\.venv" >nul 2>nul
        if errorlevel 1 py -3 -m venv "%ROOT%backend\.venv"
    ) else (
        where python >nul 2>nul
        if not errorlevel 1 (
            python -m venv "%ROOT%backend\.venv"
        ) else (
            echo ERROR: Python was not found.
            echo Install Python 3.10+ or 3.12+ and enable Add Python to PATH.
            pause
            exit /b 1
        )
    )
)

if not exist "%PYTHON_EXE%" (
    echo ERROR: Could not create backend\.venv.
    pause
    exit /b 1
)

echo Installing/updating backend requirements...
"%PYTHON_EXE%" -m pip install --upgrade pip
if errorlevel 1 (
    echo ERROR: pip upgrade failed.
    pause
    exit /b 1
)

if exist "%ROOT%backend\requirements.txt" (
    "%PYTHON_EXE%" -m pip install -r "%ROOT%backend\requirements.txt"
    if errorlevel 1 (
        echo ERROR: backend requirements install failed.
        pause
        exit /b 1
    )
) else (
    echo WARNING: backend\requirements.txt not found. Skipping backend package install.
)

REM ------------------------------------------------------------
REM Node / frontend setup
REM ------------------------------------------------------------
where npm >nul 2>nul
if errorlevel 1 (
    echo ERROR: npm was not found.
    echo Install Node.js LTS, then rerun this launcher.
    pause
    exit /b 1
)

if not exist "%ROOT%frontend\node_modules\.bin\vite.cmd" (
    echo Frontend packages missing or incomplete. Running npm install...
    pushd "%ROOT%frontend"
    call npm install
    if errorlevel 1 (
        popd
        echo ERROR: npm install failed.
        pause
        exit /b 1
    )
    popd
)

REM ------------------------------------------------------------
REM Launch servers
REM ------------------------------------------------------------
echo.
echo Starting Nova Frontiers...
echo Backend:  http://127.0.0.1:8000
echo Frontend: http://127.0.0.1:5173
echo.

REM Use /D to set working directories instead of embedding cd commands.
REM This avoids the Windows START quote bug that opens folders instead of running servers.
start "Nova Frontiers Backend" /D "%ROOT%backend" "%ComSpec%" /k ""%PYTHON_EXE%" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"

timeout /t 2 /nobreak >nul

start "Nova Frontiers Frontend" /D "%ROOT%frontend" "%ComSpec%" /k "npm run dev -- --host 127.0.0.1 --port 5173"

timeout /t 4 /nobreak >nul
start "" "http://127.0.0.1:5173"

echo.
echo Started. Leave the Backend and Frontend terminal windows open.
echo Close those two windows to stop the game.
echo.
pause
