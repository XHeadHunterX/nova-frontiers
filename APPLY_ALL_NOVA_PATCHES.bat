@echo off
setlocal enabledelayedexpansion
cd /d %~dp0

echo Applying Nova Frontiers combined patch bundle...

call :run apply_nova_auto_battle_map_perf_patch.py
call :run apply_nova_instant_map_travel_patch.py
call :run apply_nova_floating_chat_messages_patch.py
call :run apply_nova_mmo_workable_tutorial_pass.py
call :run apply_nova_security_defense_system_patch.py
call :run apply_nova_guild_rewrite_foundation_patch.py
call :run apply_nova_leaderboards_state_slimming_patch.py
call :run apply_nova_guild_war_map_levels_patch.py

echo.
echo All patch scripts completed.
echo Restart backend/frontend, then validate with:
echo   python -m py_compile backend\app\main.py
echo   cd frontend ^&^& npm run build
exit /b 0

:run
set SCRIPT=%~1
echo.
echo ==== Running %SCRIPT% ====
python "%SCRIPT%" .
if errorlevel 1 (
  echo FAILED: %SCRIPT%
  exit /b 1
)
echo OK: %SCRIPT%
exit /b 0
