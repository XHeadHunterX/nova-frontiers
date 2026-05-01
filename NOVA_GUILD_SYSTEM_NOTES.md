# NOVA_GUILD_SYSTEM_NOTES_V1

# Nova Frontiers Guild System Rewrite Foundation

This patch adds a normalized guild foundation built around this loop:

players gather/fight/craft/mission -> guild contribution XP -> guild levels -> research points/member cap -> armory/treasury support -> guild/planet wars.

## Implemented tables

- guild_settings
- guilds
- guild_ranks
- guild_members
- guild_applications
- guild_invites
- guild_contributions_daily
- guild_contribution_events
- guild_research_definitions
- guild_research
- guild_armory
- guild_treasury_log
- guild_wars
- guild_war_scores
- guild_planet_influence
- guild_logs

## Implemented endpoints

- GET /api/guild/me
- GET /api/guild/list
- GET /api/guild/detail
- GET /api/guild/roster
- POST /api/guild/create
- POST /api/guild/apply
- POST /api/guild/invite
- POST /api/guild/invite/respond
- POST /api/guild/leave
- POST /api/guild/kick
- POST /api/guild/rank/update
- GET /api/guild/contributions
- POST /api/guild/contributions/record
- GET /api/guild/research
- POST /api/guild/research/unlock
- GET /api/guild/armory
- POST /api/guild/armory/deposit
- POST /api/guild/armory/withdraw
- GET /api/guild/treasury
- POST /api/guild/treasury/deposit
- POST /api/guild/war/declare
- POST /api/guild/war/surrender
- GET /api/guild/wars
- GET /api/guild/logs
- GET /api/admin/guild/settings
- POST /api/admin/guild/settings

## Balance defaults

- Guild creation cost: 25,000 money.
- Starting size: 10.
- Level cap: 5.
- Max size at level 5: 50.
- Daily contribution soft cap: 2,500 guild XP per player.
- Over-cap contribution value: 20%.
- New member armory withdrawal lock: 24 hours.
- Guild war base cost: 50,000.
- Planet war base cost: 150,000.
- Guild war prep: 30 minutes.
- Guild war duration: 24 hours.
- Planet war duration: 48 hours.
- Same-target war cooldown: 48 hours.

## Critical integration note

The armory is intentionally planet-specific. Deposit/withdraw uses a safe inventory adapter that only modifies inventory if it detects a compatible planet-specific inventory table. If it cannot detect one, it blocks the action instead of creating a duplication exploit.

If your project inventory table has a custom name/shape, wire it into `_nova_guild_inventory_change` inside `backend/app/main.py`.

## Contribution hook

The reusable backend function is:

```python
nova_record_guild_contribution(conn, player_id, contribution_type, raw_xp, quantity, source, metadata)
```

Call it after existing mining, processing, crafting, mission, combat, salvage, delivery, event, and war actions. This avoids polluting `/api/state` and keeps guild progression event-driven.

## MMO performance choices

- Guild data does not get appended into every `/api/state` response.
- Guild page fetches only when opened.
- Logs are paginated/capped.
- Contributions use daily aggregate rows plus compact event rows.
- Armory, treasury, war declaration, and research unlock paths use immediate SQLite transactions.

## Known first-pass boundary

This patch creates war declarations, scores, timers, and costs. It does not yet hook every PvP/objective/combat kill into `guild_war_scores`; wire those scoring updates into existing combat resolution after confirming your exact battle helper names.
