#!/usr/bin/env python3
"""
Nova Frontiers long-horizon balance simulator.

Baseline:
- No-lifer player averaging 12 active hours/day, 7 days/week.
- Broad loop rotation: trade, smuggling, travel, mining, salvage, crafting,
  combat, bounties, exploration, hauling, repairs, security, planet missions,
  and career work.
- Target shape: first 25% in about 1 month, next 50% in about 6 months,
  final 25% in about 6 months, for about 13 months total.

Run:
    python backend/tools/balance_simulation.py --runs 1000

Output:
    JSON summary printed to stdout, or written with --output.
"""
from __future__ import annotations

import argparse
import json
import math
import random
import statistics
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

TARGET_DAYS = 395
TARGET_FIRST_QUARTER_DAYS = 30
TARGET_THIRD_QUARTER_DAYS = 210
ACTIVE_HOURS_PER_DAY = 12
ACTIONS_PER_HOUR = 42
ACTIONS_PER_DAY = ACTIVE_HOURS_PER_DAY * ACTIONS_PER_HOUR

SKILL_MAX_LEVEL = 100
SKILL_EARLY_LEVEL = 25
SKILL_MID_LEVEL = 75
SKILL_EARLY_XP = 500_000
SKILL_MID_XP = 3_400_000
SKILL_CAP_XP = 6_400_000
SKILL_EARLY_POWER = 1.55
SKILL_MID_POWER = 1.45
SKILL_LATE_POWER = 2.20
ACTION_TRAINING_XP_MULT = 3.60
GLOBAL_SKILL_XP_GAIN_MULT = 7.20

PLAYER_MAX_LEVEL = 100
CAREER_MAX_XP = 560_000
CAREER_PRIMARY_TARGET = 6_500
ACHIEVEMENT_LOOP_TARGET = 9_000
COMPLETION_CREDIT_GOAL = 300_000_000

SKILLS = [
    "mining", "crafting", "trading", "market_negotiation", "hauling",
    "combat", "bounty_hunting", "salvaging", "exploration", "scanning",
    "engineering", "ship_repair", "smuggling", "jailbreaking", "piloting",
]

CAREERS = [
    "trader", "smuggler", "bounty_hunter", "miner", "salvager", "explorer",
    "engineer", "security_pilot", "marshal", "dockmaster", "shipwright",
    "quartermaster", "medic", "mercenary", "diplomat",
]

ACTION_PROGRESSION = {
    "legal_trade": {
        "skills": {"trading": 18, "market_negotiation": 10},
        "careers": {"trader": 90, "dockmaster": 55, "quartermaster": 45, "diplomat": 35},
    },
    "illicit_trade": {"skills": {"smuggling": 22, "trading": 8}, "careers": {"smuggler": 115}},
    "breakout": {"skills": {"jailbreaking": 38, "smuggling": 8}, "careers": {"smuggler": 45}},
    "travel": {
        "skills": {"piloting": 10, "exploration": 4},
        "careers": {"explorer": 24, "quartermaster": 14},
    },
    "mining": {"skills": {"mining": 36, "piloting": 6, "engineering": 5}, "careers": {"miner": 135}},
    "salvage": {
        "skills": {"salvaging": 34, "engineering": 8, "scanning": 5},
        "careers": {"salvager": 125, "engineer": 45},
    },
    "crafting": {"skills": {"crafting": 34, "engineering": 18}, "careers": {"engineer": 95, "shipwright": 125}},
    "combat": {"skills": {"combat": 30, "piloting": 8}, "careers": {"mercenary": 110, "security_pilot": 80}},
    "bounty": {
        "skills": {"combat": 22, "bounty_hunting": 32, "scanning": 8},
        "careers": {"bounty_hunter": 140, "security_pilot": 55, "marshal": 55},
    },
    "exploration": {
        "skills": {"exploration": 32, "scanning": 20, "piloting": 8},
        "careers": {"explorer": 135},
    },
    "hauling": {
        "skills": {"hauling": 28, "piloting": 10, "trading": 8},
        "careers": {"quartermaster": 100, "trader": 35},
    },
    "repair": {"skills": {"ship_repair": 26, "engineering": 18}, "careers": {"engineer": 85, "shipwright": 65, "medic": 75}},
    "security": {
        "skills": {"combat": 20, "scanning": 10, "piloting": 6},
        "careers": {"security_pilot": 125, "marshal": 80},
    },
    "planet_mission": {
        "skills": {"exploration": 18, "scanning": 12, "salvaging": 8, "combat": 6},
        "careers": {"explorer": 55, "salvager": 45, "security_pilot": 35},
    },
}

ACHIEVEMENT_ACTION_MAP = {
    "mining": "mining",
    "salvage": "salvage",
    "legal_trade": "trading",
    "illicit_trade": "smuggling",
    "exploration": "exploration",
    "planet_mission": "exploration",
    "combat": "combat",
    "bounty": "combat",
    "security": "security",
    "hauling": "logistics",
    "crafting": "crafting",
    "repair": "crafting",
}

ACTION_WEIGHTS = {
    "legal_trade": 8,
    "illicit_trade": 4,
    "breakout": 2,
    "travel": 7,
    "mining": 8,
    "salvage": 8,
    "crafting": 7,
    "combat": 6,
    "bounty": 6,
    "exploration": 7,
    "hauling": 7,
    "repair": 4,
    "security": 5,
    "planet_mission": 7,
}

RISK_XP_FACTOR = {
    "legal_trade": 0.86,
    "illicit_trade": 1.20,
    "breakout": 1.10,
    "travel": 0.42,
    "mining": 0.96,
    "salvage": 1.04,
    "crafting": 0.90,
    "combat": 1.18,
    "bounty": 1.28,
    "exploration": 1.10,
    "hauling": 0.78,
    "repair": 0.72,
    "security": 1.02,
    "planet_mission": 1.12,
}

PLAYER_XP_BY_ACTION = {
    "legal_trade": 28,
    "illicit_trade": 42,
    "breakout": 30,
    "travel": 6,
    "mining": 34,
    "salvage": 36,
    "crafting": 31,
    "combat": 50,
    "bounty": 60,
    "exploration": 42,
    "hauling": 24,
    "repair": 18,
    "security": 44,
    "planet_mission": 46,
}

CREDIT_BY_ACTION = {
    "legal_trade": 1450,
    "illicit_trade": 2300,
    "breakout": 0,
    "travel": 0,
    "mining": 900,
    "salvage": 1050,
    "crafting": 700,
    "combat": 1350,
    "bounty": 2400,
    "exploration": 1250,
    "hauling": 1600,
    "repair": 780,
    "security": 1450,
    "planet_mission": 1350,
}

SKILL_TO_ACTIONS = {
    skill: [action for action, cfg in ACTION_PROGRESSION.items() if skill in cfg["skills"]]
    for skill in SKILLS
}


@dataclass
class SimState:
    skill_xp: Dict[str, float]
    career_xp: Dict[str, float]
    career_primary: Dict[str, float]
    achievement: Dict[str, float]
    player_xp_total: float = 0.0
    credits: float = 0.0
    first_quarter_day: int = 0
    third_quarter_day: int = 0


def percentile(values: List[float], pct: float) -> float:
    values = sorted(values)
    if not values:
        return 0.0
    k = (len(values) - 1) * pct
    lo = math.floor(k)
    hi = math.ceil(k)
    if lo == hi:
        return float(values[int(k)])
    return float(values[lo] * (hi - k) + values[hi] * (k - lo))


def skill_xp_required(level: int) -> int:
    level = max(1, int(level or 1))
    if level <= SKILL_EARLY_LEVEL:
        t = level / float(SKILL_EARLY_LEVEL)
        return int(max(1, SKILL_EARLY_XP * (t ** SKILL_EARLY_POWER)))
    if level <= SKILL_MID_LEVEL:
        t = (level - SKILL_EARLY_LEVEL) / float(SKILL_MID_LEVEL - SKILL_EARLY_LEVEL)
        return int(SKILL_EARLY_XP + (SKILL_MID_XP - SKILL_EARLY_XP) * (t ** SKILL_MID_POWER))
    t = (level - SKILL_MID_LEVEL) / float(SKILL_MAX_LEVEL - SKILL_MID_LEVEL)
    return int(SKILL_MID_XP + (SKILL_CAP_XP - SKILL_MID_XP) * (t ** SKILL_LATE_POWER))


def skill_level_from_xp(xp: float) -> int:
    level = 0
    while level < SKILL_MAX_LEVEL and xp >= skill_xp_required(level + 1):
        level += 1
    return level


def level_xp_required(level: int) -> int:
    level = max(1, int(level or 1))
    if level <= 25:
        return int(350 + 105 * (level ** 1.12))
    if level <= 75:
        return int(3100 + 62 * ((level - 25) ** 1.62))
    return int(20000 + 1150 * ((level - 75) ** 1.72))


PLAYER_LEVEL_CAP_XP = sum(level_xp_required(level) for level in range(1, PLAYER_MAX_LEVEL))


def player_level_from_total_xp(xp: float) -> int:
    level = 1
    remaining = max(0.0, float(xp or 0.0))
    while level < PLAYER_MAX_LEVEL:
        needed = level_xp_required(level)
        if remaining < needed:
            break
        remaining -= needed
        level += 1
    return level


def weighted_choice(rng: random.Random, weights: Dict[str, int]) -> str:
    total = sum(max(0, int(v)) for v in weights.values())
    roll = rng.uniform(0, total)
    acc = 0.0
    for key, weight in weights.items():
        acc += max(0, int(weight))
        if roll <= acc:
            return key
    return next(iter(weights))


def add_action(state: SimState, action: str, count: float, rng: random.Random, success_factor: float = 1.0) -> None:
    if count <= 0:
        return
    cfg = ACTION_PROGRESSION[action]
    risk_factor = RISK_XP_FACTOR[action]
    noise = rng.lognormvariate(0, 0.08)
    mult = count * risk_factor * success_factor * noise
    skill_mult = ACTION_TRAINING_XP_MULT * GLOBAL_SKILL_XP_GAIN_MULT
    for skill, raw_xp in cfg["skills"].items():
        state.skill_xp[skill] += raw_xp * skill_mult * mult

    careers = cfg.get("careers") or {}
    if careers:
        # A completion-minded player rotates the active career to the weakest relevant one.
        career = min(careers, key=lambda c: min(state.career_xp[c] / CAREER_MAX_XP, state.career_primary[c] / CAREER_PRIMARY_TARGET))
        state.career_xp[career] += careers[career] * GLOBAL_SKILL_XP_GAIN_MULT * mult
        state.career_primary[career] += count * success_factor

    loop = ACHIEVEMENT_ACTION_MAP.get(action)
    if loop:
        achievement_mult = 0.55 if action in {"travel", "repair"} else 0.85 if action in {"legal_trade", "hauling"} else 1.05 if action in {"combat", "bounty", "illicit_trade"} else 1.0
        state.achievement[loop] = state.achievement.get(loop, 0.0) + count * achievement_mult * success_factor

    state.player_xp_total += PLAYER_XP_BY_ACTION[action] * mult
    maturity = min(1.0, state.player_xp_total / PLAYER_LEVEL_CAP_XP)
    state.credits += CREDIT_BY_ACTION[action] * count * (0.72 + maturity * 0.56) * rng.lognormvariate(0, 0.05)


def run_day(state: SimState, day: int, rng: random.Random) -> None:
    actions_today = max(1.0, rng.gauss(ACTIONS_PER_DAY, ACTIONS_PER_DAY * 0.08))
    targeted = actions_today * rng.uniform(0.38, 0.46)
    broad = actions_today * rng.uniform(0.44, 0.52)
    afk = max(0.0, actions_today - targeted - broad)

    weak_skills = sorted(SKILLS, key=lambda skill: state.skill_xp[skill] / SKILL_CAP_XP)[:5]
    for skill in weak_skills:
        action = max(SKILL_TO_ACTIONS[skill], key=lambda a: ACTION_PROGRESSION[a]["skills"][skill] * RISK_XP_FACTOR[a])
        add_action(state, action, targeted / len(weak_skills), rng)

    total_weight = sum(ACTION_WEIGHTS.values())
    for action, weight in ACTION_WEIGHTS.items():
        count = broad * weight / total_weight * rng.uniform(0.88, 1.12)
        success = rng.uniform(0.92, 1.04)
        if action in {"combat", "bounty", "security", "illicit_trade", "planet_mission"}:
            success = rng.uniform(0.82, 1.10)
        add_action(state, action, count, rng, success)

    for action, share in {"travel": 0.30, "legal_trade": 0.24, "hauling": 0.20, "repair": 0.12, "mining": 0.14}.items():
        add_action(state, action, afk * share, rng, 0.72)

    # Career board work is a separate loop: strong active play rotates through all jobs,
    # gives account XP/credits, and feeds the skill loop through each job's mapped action.
    career_actions = {
        "miner": "mining", "salvager": "salvage", "engineer": "crafting", "shipwright": "crafting",
        "trader": "legal_trade", "dockmaster": "legal_trade", "quartermaster": "hauling",
        "bounty_hunter": "bounty", "security_pilot": "security", "marshal": "security", "mercenary": "combat",
        "explorer": "exploration", "smuggler": "illicit_trade", "medic": "repair", "diplomat": "legal_trade",
    }
    board_actions = max(4.0, actions_today * 0.08)
    weakest_careers = sorted(CAREERS, key=lambda c: min(state.career_xp[c] / CAREER_MAX_XP, state.career_primary[c] / CAREER_PRIMARY_TARGET))[:4]
    for career in weakest_careers:
        count = board_actions / len(weakest_careers)
        action = career_actions[career]
        tier = 1.0 + min(1.0, day / TARGET_DAYS)
        state.career_xp[career] += 850 * count * tier * rng.uniform(0.9, 1.12)
        state.career_primary[career] += count
        add_action(state, action, count * 0.55, rng, 1.0)
        state.player_xp_total += 170 * count * tier
        state.credits += 13_000 * count * tier * rng.lognormvariate(0, 0.10)


def component_progress(state: SimState) -> Dict[str, float]:
    skills = min(min(skill_level_from_xp(xp) for xp in state.skill_xp.values()) / SKILL_MAX_LEVEL, 1.0)
    career_parts = [
        min(state.career_xp[c] / CAREER_MAX_XP, state.career_primary[c] / CAREER_PRIMARY_TARGET, 1.0)
        for c in CAREERS
    ]
    careers = min(career_parts) if career_parts else 1.0
    player = min(player_level_from_total_xp(state.player_xp_total) / PLAYER_MAX_LEVEL, 1.0)
    credits = min(state.credits / COMPLETION_CREDIT_GOAL, 1.0)
    achievements = min((min(state.achievement.values()) if state.achievement else 0.0) / ACHIEVEMENT_LOOP_TARGET, 1.0)
    return {
        "skills": skills,
        "career_ranks": careers,
        "player_level": player,
        "credits_and_assets": credits,
        "loop_achievements": achievements,
    }


def weighted_progress(parts: Dict[str, float]) -> float:
    return (
        parts["skills"] * 0.38
        + parts["career_ranks"] * 0.28
        + parts["player_level"] * 0.12
        + parts["credits_and_assets"] * 0.12
        + parts["loop_achievements"] * 0.10
    )


def simulate_one(seed: int) -> Tuple[int, Dict[str, float]]:
    rng = random.Random(seed)
    state = SimState(
        skill_xp={skill: 0.0 for skill in SKILLS},
        career_xp={career: 0.0 for career in CAREERS},
        career_primary={career: 0.0 for career in CAREERS},
        achievement={loop: 0.0 for loop in set(ACHIEVEMENT_ACTION_MAP.values())},
    )
    last_parts: Dict[str, float] = {}
    first_quarter = 0
    third_quarter = 0
    component_days = {key: 0 for key in ["skills", "career_ranks", "player_level", "credits_and_assets", "loop_achievements"]}

    for day in range(1, 900):
        run_day(state, day, rng)
        parts = component_progress(state)
        last_parts = parts
        core_leveling_progress = min(skill_level_from_xp(xp) for xp in state.skill_xp.values()) / SKILL_MAX_LEVEL
        if not first_quarter and core_leveling_progress >= 0.25:
            first_quarter = day
        if not third_quarter and core_leveling_progress >= 0.75:
            third_quarter = day
        for key, value in parts.items():
            if not component_days[key] and value >= 1.0:
                component_days[key] = day
        if all(value >= 1.0 for value in parts.values()):
            return day, {
                **{f"{key}_day": float(component_days[key] or day) for key in component_days},
                "first_quarter_day": float(first_quarter or day),
                "third_quarter_day": float(third_quarter or day),
                **{f"{key}_progress": round(value, 4) for key, value in parts.items()},
            }

    return 900, {
        **{f"{key}_day": float(component_days[key] or 900) for key in component_days},
        "first_quarter_day": float(first_quarter or 900),
        "third_quarter_day": float(third_quarter or 900),
        **{f"{key}_progress": round(value, 4) for key, value in last_parts.items()},
    }


def summarize(values: Iterable[float]) -> Dict[str, float]:
    vals = list(values)
    return {
        "mean": round(statistics.mean(vals), 2),
        "median": round(statistics.median(vals), 2),
        "min": min(vals),
        "max": max(vals),
        "p10": round(percentile(vals, 0.10), 2),
        "p90": round(percentile(vals, 0.90), 2),
    }


def run_simulation(runs: int, seed: int) -> Dict[str, object]:
    completion_days: List[int] = []
    components: List[Dict[str, float]] = []
    for idx in range(runs):
        days, detail = simulate_one(seed + idx)
        completion_days.append(days)
        components.append(detail)

    component_keys = ["skills", "career_ranks", "player_level", "credits_and_assets", "loop_achievements"]
    return {
        "baseline": {
            "active_hours_per_day": ACTIVE_HOURS_PER_DAY,
            "active_days_per_week": 7,
            "actions_per_hour": ACTIONS_PER_HOUR,
            "target_first_quarter_days": TARGET_FIRST_QUARTER_DAYS,
            "target_third_quarter_days": TARGET_THIRD_QUARTER_DAYS,
            "target_completion_days": TARGET_DAYS,
            "target_months": 13,
            "note": "Balanced player rotates all finite loops; procedural content is modeled as mastery/achievement tracks.",
        },
        "runs": runs,
        "completion_days": summarize(completion_days),
        "milestone_days": {
            "first_quarter": summarize([c["first_quarter_day"] for c in components]),
            "third_quarter": summarize([c["third_quarter_day"] for c in components]),
        },
        "component_days": {
            key: summarize([c[f"{key}_day"] for c in components])
            for key in component_keys
        },
        "loop_reward_model": {
            "riskier_higher_level_loops": ["bounty", "combat", "illicit_trade", "planet_mission", "exploration", "salvage"],
            "easier_or_afk_loops": ["travel", "repair", "legal_trade", "hauling"],
            "all_progression_actions": sorted(ACTION_PROGRESSION.keys()),
        },
        "calibrated_constants": {
            "SKILL_XP_BALANCE.early_xp_at_cutoff": SKILL_EARLY_XP,
            "SKILL_XP_BALANCE.mid_xp_at_cutoff": SKILL_MID_XP,
            "SKILL_XP_BALANCE.max_xp_at_cap": SKILL_CAP_XP,
            "SKILL_XP_BALANCE.action_training_xp_mult": ACTION_TRAINING_XP_MULT,
            "ECOSYSTEM_BALANCE.reward_mult.pve_xp": GLOBAL_SKILL_XP_GAIN_MULT,
            "PROGRESSION_BALANCE.completion_credit_goal": COMPLETION_CREDIT_GOAL,
            "career_rank_10_xp": CAREER_MAX_XP,
            "career_rank_10_primary_actions": CAREER_PRIMARY_TARGET,
            "achievement_loop_cap": ACHIEVEMENT_LOOP_TARGET,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", type=int, default=1000)
    parser.add_argument("--seed", type=int, default=100000)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = run_simulation(args.runs, args.seed)
    text = json.dumps(result, indent=2)
    if args.output:
        args.output.write_text(text + "\n", encoding="utf-8")
    print(text)


if __name__ == "__main__":
    main()
