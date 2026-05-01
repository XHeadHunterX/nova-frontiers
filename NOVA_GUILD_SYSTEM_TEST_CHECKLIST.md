# NOVA_GUILD_SYSTEM_TEST_CHECKLIST_V1

Run this after applying the patch.

## Backend compile

```bash
python -m py_compile backend/app/main.py
```

## Frontend build

```bash
cd frontend
npm run build
```

## Guild creation

- Dock a player at a planet.
- Give the player enough money.
- Open Guild page.
- Create guild.
- Confirm money is deducted.
- Confirm guild HQ/home planet equals current planet.
- Confirm leader rank exists.
- Confirm max members is 10.

## Join / invite / apply

- Use a second player.
- Apply to guild.
- Send invite from leader/officer.
- Accept invite.
- Confirm one guild per player.
- Confirm full guild blocks joins.

## Ranks / permissions

- Promote/demote lower ranks.
- Try to kick same/higher rank; should fail.
- Try officer/recruit destructive actions; unauthorized should fail.
- Confirm recruit cannot withdraw armory by default.

## Contributions

- POST /api/guild/contributions/record with mining/material/combat/mission/crafting/war types.
- Confirm daily aggregate updates.
- Confirm guild XP increases.
- Confirm over soft cap uses reduced XP.
- Confirm guild levels at configured thresholds.
- Confirm research points are granted on level-up.

## Research

- Unlock research with leader/officer.
- Confirm points decrease.
- Confirm rank increases.
- Confirm max rank blocks further purchase.
- Confirm level requirement blocks too-early research.

## Armory

- Deposit item at planet.
- Confirm current planet required.
- Confirm incompatible inventory adapter blocks instead of duping.
- Confirm item stays tied to planet_id.
- Withdraw item as recruit; should fail.
- Withdraw item as leader/officer/veteran if allowed.
- Confirm withdrawal cannot exceed quantity.
- Confirm locked/new-member rule works.

## Treasury

- Deposit money.
- Confirm player money decreases.
- Confirm treasury increases.
- Confirm treasury log row is created.
- Confirm money contribution XP is recorded.

## Wars

- Declare guild war.
- Confirm treasury cost is deducted.
- Confirm prep/start/end timestamps exist.
- Confirm same-target cooldown blocks repeated declaration.
- Declare planet war.
- Confirm higher planet war base cost.
- Surrender war with authorized member.
- Confirm unauthorized surrender fails.

## Logs

- Confirm logs for create, join, invite, rank update, treasury deposit, armory deposit/withdraw, research unlock, war declare.

## Race / duplicate attempts

- Double-click treasury deposit.
- Double-click armory withdrawal.
- Try negative quantities.
- Try withdraw more than exists.
- Try direct endpoint calls as non-member.
- Try client-side rank spoofing.
