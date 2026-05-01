Nova Frontiers - Combined Patch Bundle

This bundle includes the patch kits generated in this chat and an optional master updater.

Included patches:
1. auto battle + larger galaxy map + planet redistribution
2. instant map travel visual start
3. floating chat + messages
4. MMO workable/tutorial/performance pass
5. security defense system
6. guild rewrite foundation
7. leaderboards + state slimming
8. guild war map highlighting + level labels

Not included:
- The older "npc initiated battles" patch from the other chat, because that artifact was not available in this chat session.

Recommended use:
- Put all files from this bundle into the Nova Frontiers project root.
- Run APPLY_ALL_NOVA_PATCHES.bat from the project root.
- If one patch fails, stop and inspect the related patch script/changelog.

Recommended order used by the master script:
1. apply_nova_auto_battle_map_perf_patch.py
2. apply_nova_instant_map_travel_patch.py
3. apply_nova_floating_chat_messages_patch.py
4. apply_nova_mmo_workable_tutorial_pass.py
5. apply_nova_security_defense_system_patch.py
6. apply_nova_guild_rewrite_foundation_patch.py
7. apply_nova_leaderboards_state_slimming_patch.py
8. apply_nova_guild_war_map_levels_patch.py

After apply:
- Restart backend and frontend.
- Run syntax/build validation:
  python -m py_compile backend/app/main.py
  cd frontend
  npm run build

Notes:
- Several patches touch the same files: backend/app/main.py, frontend/src/main.jsx, frontend/src/styles.css.
- Because these are text patchers, apply them only once on the intended Nova Frontiers codebase.
- Some patches include integration notes where exact function names may differ in your project.
