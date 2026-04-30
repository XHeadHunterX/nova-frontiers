#!/usr/bin/env python3
"""
Nova Frontiers long-horizon balance simulator.

Purpose:
- Baseline: no-lifer player averaging 12 active hours/day, 7 days/week.
- Target: maxing the major finite progression systems should land around 2 years.
- This sim intentionally treats procedural/per-planet infinite content as mastery tracks,
  not every individual generated planet, because that would never terminate.

Run:
    python backend/tools/balance_simulation.py --runs 1000

Output:
    JSON summary printed to stdout.
"""
from __future__ import annotations

import argparse
import json
import math
import random
import statistics
from typing import Dict, List, Tuple

TARGET_DAYS = 730
ACTIVE_HOURS_PER_DAY = 12
ACTIONS_PER_HOUR = 42

SKILL_BASE_CURVE = 620
SKILL_CURVE_POWER = 1.95
SKILL_MAX_LEVEL = 100
GLOBAL_SKILL_XP_GAIN_MULT = 7.20

SKILLS = [
    "mining", "crafting", "trading", "market_negotiation", "hauling",
    "combat", "bounty_hunting", "salvaging", "exploration", "scanning",
    "engineering", "ship_repair", "smuggling", "jailbreaking", "piloting",
]

ACTION_PROGRESSION = {
    "legal_trade": {"trading": 18, "market_negotiation": 10},
    "illicit_trade": {"smuggling": 22, "trading": 8},
    "breakout": {"jailbreaking": 38, "smuggling": 8},
    "travel": {"piloting": 10, "exploration": 4},
    "mining": {"mining": 36, "piloting": 6, "engineering": 5},
    "salvage": {"salvaging": 34, "engineering": 8, "scanning": 5},
    "crafting": {"crafting": 34, "engineering": 18},
    "combat": {"combat": 30, "piloting": 8},
    "bounty": {"combat": 22, "bounty_hunting": 32, "scanning": 8},
    "exploration": {"exploration": 32, "scanning": 20, "piloting": 8},
    "hauling": {"hauling": 28, "piloting": 10, "trading": 8},
    "repair": {"ship_repair": 26, "engineering": 18},
    "security": {"combat": 20, "scanning": 10, "piloting": 6},
    "planet_mission": {"exploration": 18, "scanning": 12, "salvaging": 8, "combat": 6},
}

ACTION_WEIGHTS = {
    "legal_trade": 8,
    "illicit_trade": 4,
    "breakout": 1,
    "travel": 8,
    "mining": 9,
    "salvage": 8,
    "crafting": 8,
    "combat": 6,
    "bounty": 6,
    "exploration": 8,
    "hauling": 7,
    "repair": 4,
    "security": 4,
    "planet_mission": 8,
}

SKILL_TO_ACTIONS = {
    skill: [action for action, awards in ACTION_PROGRESSION.items() if skill in awards]
    for skill in SKILLS
}

# These are calibrated against the live progression multipliers in ECOSYSTEM_BALANCE.
# The credit target represents all finite sinks combined: ships, modules, recipes,
# upgrade attempts, base placement, research, building, fees, failed crafting, and market friction.
FINITE_CREDIT_SINK_TARGET = 4.30e9
BASE_WALL_MEAN_DAYS = 625
BASE_WALL_STD_DAYS = 22
CRAFTING_WALL_MEAN_DAYS = 611
CRAFTING_WALL_STD_DAYS = 45
ACHIEVEMENT_WALL_MEAN_DAYS = 686
ACHIEVEMENT_WALL_STD_DAYS = 38


def skill_threshold() -> float:
    return SKILL_BASE_CURVE * (SKILL_MAX_LEVEL ** SKILL_CURVE_POWER)


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


def simulate_one(seed: int) -> Tuple[int, Dict[str, float]]:
    rng = random.Random(seed)
    threshold = skill_threshold()
    xp = {skill: 0.0 for skill in SKILLS}
    skill_done = False
    skill_day = 0

    credit = 0.0
    credit_day = 0
    sink_target = rng.lognormvariate(math.log(FINITE_CREDIT_SINK_TARGET), 0.06)

    base_wall = max(570.0, rng.gauss(BASE_WALL_MEAN_DAYS, BASE_WALL_STD_DAYS))
    crafting_wall = max(480.0, rng.gauss(CRAFTING_WALL_MEAN_DAYS, CRAFTING_WALL_STD_DAYS))
    achievement_wall = max(580.0, rng.gauss(ACHIEVEMENT_WALL_MEAN_DAYS, ACHIEVEMENT_WALL_STD_DAYS))

    for day in range(1, 2000):
        # Credit income rises with account maturity but is capped by the nerfed reward/vendor economy.
        daily_credit = (1.75e6 + min(day, TARGET_DAYS) * 11200) * rng.lognormvariate(0, 0.18)
        daily_credit *= rng.uniform(0.92, 1.08)
        credit += daily_credit
        if not credit_day and credit >= sink_target:
            credit_day = day

        if not skill_done:
            actions_today = max(1.0, rng.gauss(ACTIONS_PER_HOUR * ACTIVE_HOURS_PER_DAY, ACTIONS_PER_HOUR * ACTIVE_HOURS_PER_DAY * 0.08))

            # A strong player will target weak skills most of the time but still needs market,
            # combat, travel, crafting, mission, and resource loops.
            targeted_actions_per_low_skill = actions_today * 0.65 / 4.0
            low_skills = sorted(SKILLS, key=lambda skill: xp[skill])[:4]
            for skill in low_skills:
                action = max(SKILL_TO_ACTIONS[skill], key=lambda a: ACTION_PROGRESSION[a][skill])
                noise = rng.lognormvariate(0, 0.08)
                for awarded_skill, raw_xp in ACTION_PROGRESSION[action].items():
                    xp[awarded_skill] += raw_xp * GLOBAL_SKILL_XP_GAIN_MULT * targeted_actions_per_low_skill * noise

            random_actions_per_loop = actions_today * 0.35 / len(ACTION_PROGRESSION)
            for action, awards in ACTION_PROGRESSION.items():
                noise = rng.lognormvariate(0, 0.10)
                for awarded_skill, raw_xp in awards.items():
                    xp[awarded_skill] += raw_xp * GLOBAL_SKILL_XP_GAIN_MULT * random_actions_per_loop * noise

            if min(xp.values()) >= threshold:
                skill_done = True
                skill_day = day

        if credit_day and skill_done and day >= base_wall and day >= crafting_wall and day >= achievement_wall:
            done = max(day, math.ceil(base_wall), math.ceil(crafting_wall), math.ceil(achievement_wall), credit_day, skill_day)
            return int(done), {
                "skills": float(skill_day),
                "credits": float(credit_day),
                "base_research_build": float(math.ceil(base_wall)),
                "crafting_recipes": float(math.ceil(crafting_wall)),
                "achievements_loops": float(math.ceil(achievement_wall)),
                "finite_credit_sink_target": float(sink_target),
            }

    return 2000, {
        "skills": float(skill_day or 2000),
        "credits": float(credit_day or 2000),
        "base_research_build": float(math.ceil(base_wall)),
        "crafting_recipes": float(math.ceil(crafting_wall)),
        "achievements_loops": float(math.ceil(achievement_wall)),
        "finite_credit_sink_target": float(sink_target),
    }


def run_simulation(runs: int, seed: int) -> Dict[str, object]:
    completion_days: List[int] = []
    components: List[Dict[str, float]] = []
    for idx in range(runs):
        days, detail = simulate_one(seed + idx)
        completion_days.append(days)
        components.append(detail)

    component_keys = ["skills", "credits", "base_research_build", "crafting_recipes", "achievements_loops"]
    return {
        "baseline": {
            "active_hours_per_day": ACTIVE_HOURS_PER_DAY,
            "active_days_per_week": 7,
            "target_days": TARGET_DAYS,
            "target_years": 2,
            "note": "Procedural/per-planet infinite content is modeled as finite mastery tracks.",
        },
        "runs": runs,
        "completion_days": {
            "mean": round(statistics.mean(completion_days), 2),
            "median": round(statistics.median(completion_days), 2),
            "min": min(completion_days),
            "max": max(completion_days),
            "p05": round(percentile(completion_days, 0.05), 2),
            "p10": round(percentile(completion_days, 0.10), 2),
            "p25": round(percentile(completion_days, 0.25), 2),
            "p75": round(percentile(completion_days, 0.75), 2),
            "p90": round(percentile(completion_days, 0.90), 2),
            "p95": round(percentile(completion_days, 0.95), 2),
        },
        "component_days_mean": {
            key: round(statistics.mean(c[key] for c in components), 2)
            for key in component_keys
        },
        "component_days_p90": {
            key: round(percentile([c[key] for c in components], 0.90), 2)
            for key in component_keys
        },
        "calibrated_constants": {
            "SKILL_XP_BALANCE.base_curve": SKILL_BASE_CURVE,
            "SKILL_XP_BALANCE.curve_power": SKILL_CURVE_POWER,
            "ECOSYSTEM_BALANCE.reward_mult.pve_xp": GLOBAL_SKILL_XP_GAIN_MULT,
            "finite_credit_sink_target": FINITE_CREDIT_SINK_TARGET,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", type=int, default=1000)
    parser.add_argument("--seed", type=int, default=100000)
    args = parser.parse_args()
    print(json.dumps(run_simulation(args.runs, args.seed), indent=2))


if __name__ == "__main__":
    main()
