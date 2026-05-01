@echo off
setlocal
cd /d %~dp0
python apply_nova_guild_war_map_levels_patch.py .
if errorlevel 1 (
  echo Patch failed.
  exit /b 1
)
echo Patch applied.
