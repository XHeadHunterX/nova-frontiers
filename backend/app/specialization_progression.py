from __future__ import annotations

import json
import math
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import HTTPException


TREE_ORDER = ["combat", "industry", "market", "exploration"]
TIER_REQUIREMENTS = {1: 0, 2: 20, 3: 40, 4: 65}
RESPEC_BASE_COST = 2500
RESPEC_HARD_CAP = 250000
CAPS = {
    "pve_damage_bonus_pct": 60,
    "pve_defense_bonus_pct": 40,
    "mining_yield_bonus_pct": 75,
    "refinement_output_bonus_pct": 40,
    "crafting_material_efficiency_pct": 25,
    "cargo_capacity_bonus_pct": 80,
    "travel_fuel_reduction_pct": 40,
    "scan_range_bonus_pct": 60,
    "anomaly_artifact_speed_bonus_pct": 50,
    "stealth_uptime_pct": 12,
}


def _utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def _json(value: Any) -> str:
    return json.dumps(value, separators=(",", ":"))


def _decode(value: Any, default: Any = None) -> Any:
    if value in (None, ""):
        return default
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except Exception:
        return default


def _rows(conn: sqlite3.Connection, sql: str, params: tuple = ()) -> List[Dict[str, Any]]:
    return [dict(r) for r in conn.execute(sql, params).fetchall()]


def _row(conn: sqlite3.Connection, sql: str, params: tuple = ()) -> Optional[Dict[str, Any]]:
    r = conn.execute(sql, params).fetchone()
    return dict(r) if r else None


def _scalar(conn: sqlite3.Connection, sql: str, params: tuple = ()) -> Any:
    return conn.execute(sql, params).fetchone()[0]


def _tree_definitions() -> List[Dict[str, Any]]:
    return [
        {
            "key": "combat", "name": "Combat", "purpose": "PvE combat power only. No PvP damage buffs.",
            "low": ["Increased weapon energy cost", "Slower target lock", "Lower NPC combat efficiency"],
            "branches": [
                ("weapon_systems", "Weapon Systems", "Sustained Fire", ["weapon damage", "attack speed", "weapon energy efficiency", "accuracy"],
                 [("weapon_damage", "Weapon Damage", "+2% weapon damage per rank against NPCs only.", {"pve_damage_bonus_pct": 2}, 5),
                  ("weapon_efficiency", "Weapon Efficiency", "-2% weapon energy cost per rank.", {"weapon_energy_cost_reduction_pct": 2}, 5),
                  ("accuracy", "Accuracy", "+1% accuracy per rank.", {"accuracy_pct": 1}, 5)]),
                ("defense_systems", "Defense Systems", "Reactive Shielding", ["shield capacity", "shield regeneration", "armor durability", "NPC damage resistance"],
                 [("shield_capacity", "Shield Capacity", "+2% shield capacity per rank.", {"shield_capacity_pct": 2}, 5),
                  ("shield_regen", "Shield Regeneration", "+2% shield regen per rank.", {"shield_regen_pct": 2}, 5),
                  ("armor_durability", "Armor Durability", "+2% armor per rank.", {"armor_pct": 2}, 5)]),
                ("targeting_systems", "Targeting Systems", "Split Targeting", ["target lock speed", "retarget delay reduction", "multi-target NPC efficiency", "crit chance against NPCs only"],
                 [("lock_speed", "Target Lock Speed", "+2% target lock speed per rank.", {"target_lock_speed_pct": 2}, 5),
                  ("retargeting", "Retarget Delay", "-2% retarget delay per rank.", {"retarget_delay_reduction_pct": 2}, 5),
                  ("npc_crit", "NPC Criticals", "+1% crit chance against NPCs only per rank.", {"npc_crit_chance_pct": 1}, 5)]),
                ("combat_energy", "Combat Energy", "Controlled Overcharge", ["max combat energy", "energy regen", "overcharge stability"],
                 [("combat_energy", "Combat Energy", "+3 max combat energy per rank.", {"max_combat_energy": 3}, 5),
                  ("energy_regen", "Energy Regeneration", "+2% combat energy regen per rank.", {"combat_energy_regen_pct": 2}, 5),
                  ("overcharge_stability", "Overcharge Stability", "+2% overcharge stability per rank.", {"overcharge_stability_pct": 2}, 5)]),
            ],
        },
        {
            "key": "industry", "name": "Industry", "purpose": "Mining, refining, and crafting. Crafting does not bypass market logistics.",
            "low": ["Lower effective yield", "Slower mining cycles", "More mining variance", "Worse refinement efficiency", "Slower crafting"],
            "branches": [
                ("extraction", "Extraction", "Overdrill", ["mining yield", "mining speed", "node depletion control", "extraction cycle time"],
                 [("mining_yield", "Mining Yield", "+2% mining yield per rank.", {"mining_yield_bonus_pct": 2}, 5),
                  ("mining_speed", "Mining Speed", "+2% mining speed per rank.", {"mining_speed_pct": 2}, 5),
                  ("depletion_control", "Depletion Control", "+2% node depletion control per rank.", {"node_depletion_control_pct": 2}, 5)]),
                ("refinement", "Refinement", "Precision Refining", ["refined output", "waste reduction", "rare material chance", "batch processing speed"],
                 [("refined_output", "Refined Output", "+2% refined output per rank.", {"refinement_output_bonus_pct": 2}, 5),
                  ("waste_reduction", "Waste Reduction", "-2% refinement waste per rank.", {"refinement_waste_reduction_pct": 2}, 5),
                  ("rare_material", "Rare Material Chance", "+1% rare material chance per rank.", {"rare_material_chance_pct": 1}, 5)]),
                ("manufacturing", "Manufacturing / Crafting", "Efficient Production Run", ["crafting speed", "material efficiency", "batch crafting", "repair or module production efficiency"],
                 [("crafting_speed", "Crafting Speed", "+2% crafting speed per rank.", {"crafting_speed_pct": 2}, 5),
                  ("material_efficiency", "Material Efficiency", "+1% crafting material efficiency per rank.", {"crafting_material_efficiency_pct": 1}, 5),
                  ("module_production", "Module Production", "+2% module production efficiency per rank.", {"module_production_efficiency_pct": 2}, 5)]),
                ("industrial_stability", "Industrial Stability", "Stable Output", ["reduced mining variance", "reduced energy spikes", "durability / tool efficiency", "downtime reduction"],
                 [("mining_variance", "Mining Variance", "-2% negative mining variance per rank.", {"mining_variance_reduction_pct": 2}, 5),
                  ("energy_spikes", "Energy Spike Control", "-2% industrial energy spike risk per rank.", {"industrial_energy_spike_reduction_pct": 2}, 5),
                  ("tool_efficiency", "Tool Efficiency", "+2% tool durability efficiency per rank.", {"tool_efficiency_pct": 2}, 5)]),
            ],
        },
        {
            "key": "market", "name": "Market", "purpose": "Cargo hauling, logistics, trading, selling, and contracts. No passive income.",
            "low": ["Worse cargo efficiency", "Higher fuel cost when hauling", "Slower load/unload", "Reduced contract value"],
            "branches": [
                ("cargo_systems", "Cargo Systems", "Compression Protocol", ["cargo capacity", "cargo mass efficiency", "load/unload speed"],
                 [("cargo_capacity", "Cargo Capacity", "+2% cargo capacity per rank.", {"cargo_capacity_bonus_pct": 2}, 5),
                  ("cargo_mass", "Cargo Mass Efficiency", "+2% cargo mass efficiency per rank.", {"cargo_mass_efficiency_pct": 2}, 5),
                  ("load_speed", "Load / Unload Speed", "+2% load and unload speed per rank.", {"load_unload_speed_pct": 2}, 5)]),
                ("logistics", "Logistics", "Bulk Transit", ["warp fuel reduction", "route efficiency", "travel time reduction", "docking / undocking efficiency"],
                 [("fuel_reduction", "Hauling Fuel Reduction", "-2% hauling fuel cost per rank.", {"travel_fuel_reduction_pct": 2}, 5),
                  ("route_efficiency", "Route Efficiency", "+2% route efficiency per rank.", {"route_efficiency_pct": 2}, 5),
                  ("dock_efficiency", "Docking Efficiency", "+2% docking efficiency per rank.", {"docking_efficiency_pct": 2}, 5)]),
                ("trade_efficiency", "Trade Efficiency", "Market Insight", ["sell fee reduction", "buy fee reduction", "minor sell price improvement", "market spread visibility"],
                 [("sell_fee", "Sell Fee Reduction", "-1% sell fee per rank.", {"sell_fee_reduction_pct": 1}, 5),
                  ("buy_fee", "Buy Fee Reduction", "-1% buy fee per rank.", {"buy_fee_reduction_pct": 1}, 5),
                  ("spread_visibility", "Spread Visibility", "+1 market spread visibility per rank.", {"market_spread_visibility": 1}, 5)]),
                ("contracts", "Contracts", "Priority Contracts", ["hauling contract rewards", "contract completion speed", "reputation gain", "access to higher-value cargo jobs"],
                 [("contract_rewards", "Contract Rewards", "+2% active hauling contract reward per rank.", {"contract_reward_pct": 2}, 5),
                  ("contract_speed", "Contract Speed", "+2% contract completion speed per rank.", {"contract_speed_pct": 2}, 5),
                  ("contract_reputation", "Contract Reputation", "+2% contract reputation gain per rank.", {"contract_reputation_pct": 2}, 5)]),
            ],
        },
        {
            "key": "exploration", "name": "Exploration", "purpose": "Speed, fuel, anomalies, scanning, artifact extraction, and high-tier temporary stealth.",
            "low": ["Higher scan noise", "Worse ping accuracy", "Slower anomaly interaction", "Slower planetary missions", "Higher fuel/travel inefficiency"],
            "branches": [
                ("scanning", "Scanning", "Deep Scan", ["scan range", "scan precision", "ping clarity", "false signal reduction", "hidden anomaly detection"],
                 [("scan_range", "Scan Range", "+2% scan range per rank.", {"scan_range_bonus_pct": 2}, 5),
                  ("scan_precision", "Scan Precision", "+2% scan precision per rank.", {"scan_precision_pct": 2}, 5),
                  ("false_signal", "False Signal Reduction", "-2% false signal rate per rank.", {"false_signal_reduction_pct": 2}, 5)]),
                ("navigation", "Navigation", "Optimized Routing", ["travel speed", "route efficiency", "fuel reduction", "planetary mission travel efficiency"],
                 [("travel_speed", "Travel Speed", "+2% travel speed per rank.", {"travel_speed_pct": 2}, 5),
                  ("exploration_fuel", "Exploration Fuel", "-2% exploration fuel cost per rank.", {"travel_fuel_reduction_pct": 2}, 5),
                  ("planetary_travel", "Planetary Travel", "+2% planetary mission travel efficiency per rank.", {"planetary_mission_efficiency_pct": 2}, 5)]),
                ("anomaly_operations", "Anomaly Operations", "Signal Lock", ["anomaly interaction speed", "artifact extraction speed", "anomaly loot weighting", "planetary mission duration reduction"],
                 [("anomaly_speed", "Anomaly Speed", "+2% anomaly interaction speed per rank.", {"anomaly_artifact_speed_bonus_pct": 2}, 5),
                  ("artifact_extraction", "Artifact Extraction", "+2% artifact extraction speed per rank.", {"artifact_extraction_speed_pct": 2}, 5),
                  ("loot_weighting", "Anomaly Loot Weighting", "+1 anomaly loot weighting per rank.", {"anomaly_loot_weighting": 1}, 5)]),
                ("signature_control", "Signature Control", "Temporary Stealth", ["reduced scan signature", "reduced NPC detection chance", "safer scouting", "high-tier temporary stealth"],
                 [("scan_signature", "Scan Signature", "-2% scan signature per rank.", {"scan_signature_reduction_pct": 2}, 5),
                  ("npc_detection", "NPC Detection", "-2% NPC detection chance per rank.", {"npc_detection_reduction_pct": 2}, 5),
                  ("safe_scouting", "Safe Scouting", "+2% safer scouting per rank.", {"safe_scouting_pct": 2}, 5)]),
            ],
        },
    ]


def ensure_progression_content(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS skill_trees (
          key TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          purpose TEXT NOT NULL,
          low_investment_penalties_json TEXT NOT NULL DEFAULT '[]',
          caps_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS skill_branches (
          key TEXT PRIMARY KEY,
          tree_key TEXT NOT NULL REFERENCES skill_trees(key) ON DELETE CASCADE,
          name TEXT NOT NULL,
          bonuses_json TEXT NOT NULL DEFAULT '[]',
          keystone_name TEXT NOT NULL DEFAULT '',
          keystone_description TEXT NOT NULL DEFAULT '',
          sort_order INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS progression_skill_nodes (
          key TEXT PRIMARY KEY,
          tree_key TEXT NOT NULL REFERENCES skill_trees(key) ON DELETE CASCADE,
          branch_key TEXT NOT NULL REFERENCES skill_branches(key) ON DELETE CASCADE,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          max_rank INTEGER NOT NULL DEFAULT 5,
          sp_cost INTEGER NOT NULL DEFAULT 1,
          effects_json TEXT NOT NULL DEFAULT '{}',
          is_keystone INTEGER NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS player_progression (
          player_id INTEGER PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
          total_sp INTEGER NOT NULL DEFAULT 0,
          unspent_sp INTEGER NOT NULL DEFAULT 0,
          tree_totals_json TEXT NOT NULL DEFAULT '{}',
          respec_count INTEGER NOT NULL DEFAULT 0,
          last_respec_at TEXT,
          total_respec_cost_paid INTEGER NOT NULL DEFAULT 0,
          temporary_stealth_until TEXT,
          stealth_cooldown_until TEXT,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS player_skill_allocations (
          player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
          node_key TEXT NOT NULL REFERENCES progression_skill_nodes(key) ON DELETE CASCADE,
          ranks INTEGER NOT NULL DEFAULT 0,
          spent_sp INTEGER NOT NULL DEFAULT 0,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (player_id, node_key)
        );
        CREATE TABLE IF NOT EXISTS player_respec_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
          cost INTEGER NOT NULL DEFAULT 0,
          free INTEGER NOT NULL DEFAULT 0,
          allocations_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS ship_definitions (
          code TEXT PRIMARY KEY,
          role TEXT NOT NULL,
          tier INTEGER NOT NULL DEFAULT 1,
          required_trees_json TEXT NOT NULL DEFAULT '[]',
          required_allocation_json TEXT NOT NULL DEFAULT '{}',
          allowed_module_categories_json TEXT NOT NULL DEFAULT '[]',
          max_module_tier INTEGER NOT NULL DEFAULT 1,
          scaling_coefficients_json TEXT NOT NULL DEFAULT '{}',
          hybrid INTEGER NOT NULL DEFAULT 0,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS module_definitions (
          code TEXT PRIMARY KEY,
          category TEXT NOT NULL,
          tier INTEGER NOT NULL DEFAULT 1,
          compatible_slot_categories_json TEXT NOT NULL DEFAULT '[]',
          updated_at TEXT NOT NULL
        );
        """
    )
    now = _utc()
    for tree in _tree_definitions():
        conn.execute(
            """INSERT INTO skill_trees (key,name,purpose,low_investment_penalties_json,caps_json,created_at,updated_at)
               VALUES (?,?,?,?,?,?,?)
               ON CONFLICT(key) DO UPDATE SET name=excluded.name,purpose=excluded.purpose,
                 low_investment_penalties_json=excluded.low_investment_penalties_json,caps_json=excluded.caps_json,updated_at=excluded.updated_at""",
            (tree["key"], tree["name"], tree["purpose"], _json(tree["low"]), _json(CAPS), now, now),
        )
        for branch_index, (branch_key, branch_name, keystone, bonuses, nodes) in enumerate(tree["branches"], start=1):
            full_branch_key = f"{tree['key']}:{branch_key}"
            conn.execute(
                """INSERT INTO skill_branches (key,tree_key,name,bonuses_json,keystone_name,keystone_description,sort_order)
                   VALUES (?,?,?,?,?,?,?)
                   ON CONFLICT(key) DO UPDATE SET name=excluded.name,bonuses_json=excluded.bonuses_json,
                     keystone_name=excluded.keystone_name,keystone_description=excluded.keystone_description,sort_order=excluded.sort_order""",
                (full_branch_key, tree["key"], branch_name, _json(bonuses), keystone, keystone_description(tree["key"], keystone), branch_index),
            )
            for node_index, (node_key, name, desc, effects, max_rank) in enumerate(nodes, start=1):
                full_node_key = f"{tree['key']}:{node_key}"
                conn.execute(
                    """INSERT INTO progression_skill_nodes (key,tree_key,branch_key,name,description,max_rank,sp_cost,effects_json,is_keystone,sort_order)
                       VALUES (?,?,?,?,?,?,?,?,0,?)
                       ON CONFLICT(key) DO UPDATE SET name=excluded.name,description=excluded.description,
                         max_rank=excluded.max_rank,sp_cost=excluded.sp_cost,effects_json=excluded.effects_json,sort_order=excluded.sort_order""",
                    (full_node_key, tree["key"], full_branch_key, name, desc, max_rank, 1, _json(effects), node_index),
                )
            key_node = f"{tree['key']}:keystone:{branch_key}"
            conn.execute(
                """INSERT INTO progression_skill_nodes (key,tree_key,branch_key,name,description,max_rank,sp_cost,effects_json,is_keystone,sort_order)
                   VALUES (?,?,?,?,?,?,?, ?,1,99)
                   ON CONFLICT(key) DO UPDATE SET name=excluded.name,description=excluded.description,effects_json=excluded.effects_json""",
                (key_node, tree["key"], full_branch_key, keystone, keystone_description(tree["key"], keystone), 1, 3, _json({"keystone": keystone})),
            )
    sync_ship_and_module_definitions(conn)
    ensure_player_rows(conn)


def keystone_description(tree: str, name: str) -> str:
    return {
        "Sustained Fire": "Small capped PvE damage bonus during long NPC fights; resets when combat ends.",
        "Reactive Shielding": "Small shield recovery after taking NPC damage, gated by cooldown.",
        "Split Targeting": "Certain weapons can distribute projectiles across multiple NPC targets with reduced per-target efficiency.",
        "Controlled Overcharge": "Temporary PvE burst mode with heat buildup and cooldown.",
        "Overdrill": "Temporary mining burst with faster node depletion.",
        "Precision Refining": "Prevents bad refinement rolls within a cap.",
        "Efficient Production Run": "Reduces material waste for one crafting batch, gated by cooldown.",
        "Stable Output": "Removes negative mining low-rolls without increasing peak yield.",
        "Compression Protocol": "Temporary cargo capacity increase with cooldown.",
        "Bulk Transit": "Reduces travel penalties when cargo is near full.",
        "Market Insight": "Shows estimated price bands and better market hints.",
        "Priority Contracts": "Unlocks better cargo and market contracts.",
        "Deep Scan": "Reveals hidden or rare anomaly signatures within range.",
        "Optimized Routing": "Shortens valid travel paths or reduces route penalty.",
        "Signal Lock": "Reduces anomaly despawn risk while actively interacting.",
        "Temporary Stealth": "T4+ only; short duration, cooldown-gated, breaks on combat, mining, cargo, artifact, market, or docking actions.",
    }.get(name, f"{tree.title()} keystone.")


def ensure_player_rows(conn: sqlite3.Connection, player_id: Optional[int] = None) -> None:
    query = "SELECT id, skill_points FROM players"
    params: tuple = ()
    if player_id is not None:
        query += " WHERE id=?"
        params = (int(player_id),)
    for p in _rows(conn, query, params):
        existing = _row(conn, "SELECT * FROM player_progression WHERE player_id=?", (int(p["id"]),))
        if existing:
            continue
        total = max(0, int(p.get("skill_points") or 0))
        conn.execute(
            "INSERT INTO player_progression (player_id,total_sp,unspent_sp,tree_totals_json,updated_at) VALUES (?,?,?,?,?)",
            (int(p["id"]), total, total, _json({k: 0 for k in TREE_ORDER}), _utc()),
        )


def required_allocation_for_tier(tier: int) -> int:
    return TIER_REQUIREMENTS[4 if int(tier or 1) >= 4 else max(1, int(tier or 1))]


def role_tree(role: str) -> str:
    role = str(role or "").lower()
    if role in {"combat", "siege", "fleet", "patrol", "security"}:
        return "combat"
    if role in {"mining", "miner", "salvage", "salvager", "industry", "industrial"}:
        return "industry"
    if role in {"cargo", "trade", "hauler", "market"}:
        return "market"
    if role in {"exploration", "explorer", "scout"}:
        return "exploration"
    return ""


def role_module_categories(role: str) -> List[str]:
    tree = role_tree(role)
    if tree == "combat":
        return ["weapon", "shield", "armor", "targeting", "scanner", "energy", "engine", "utility"]
    if tree == "industry":
        return ["mining", "refining", "crafting", "cargo", "scanner", "repair", "shield", "engine", "utility"]
    if tree == "market":
        return ["cargo", "logistics", "market", "engine", "fuel", "stealth", "scanner", "shield", "utility"]
    if tree == "exploration":
        return ["scanner", "navigation", "anomaly", "signature", "stealth", "engine", "fuel", "shield", "utility"]
    return ["weapon", "shield", "armor", "mining", "cargo", "scanner", "engine", "fuel", "utility", "repair"]


def sync_ship_and_module_definitions(conn: sqlite3.Connection) -> None:
    now = _utc()
    for st in _rows(conn, "SELECT * FROM ship_templates"):
        code = str(st.get("code") or "")
        role = str(st.get("role") or "starter").lower()
        tier = max(1, min(4, int(st.get("ship_tier") or 1)))
        req_tree = role_tree(role)
        required_trees = [] if tier <= 1 or not req_tree else [req_tree]
        required = {req_tree: required_allocation_for_tier(tier)} if required_trees else {}
        hybrid = 0
        coeff = {"primary": 1.0, "secondary": 0.0, "slotOutputCap": 1.0}
        if role == "starter":
            coeff = {"primary": 0.55, "secondary": 0.35, "slotOutputCap": 0.65}
        conn.execute(
            """INSERT INTO ship_definitions
               (code,role,tier,required_trees_json,required_allocation_json,allowed_module_categories_json,max_module_tier,scaling_coefficients_json,hybrid,updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?)
               ON CONFLICT(code) DO UPDATE SET role=excluded.role,tier=excluded.tier,required_trees_json=excluded.required_trees_json,
                 required_allocation_json=excluded.required_allocation_json,allowed_module_categories_json=excluded.allowed_module_categories_json,
                 max_module_tier=excluded.max_module_tier,scaling_coefficients_json=excluded.scaling_coefficients_json,hybrid=excluded.hybrid,updated_at=excluded.updated_at""",
            (code, role, tier, _json(required_trees), _json(required), _json(role_module_categories(role)), int(st.get("ship_tier") or tier), _json(coeff), hybrid, now),
        )
    for mt in _rows(conn, "SELECT * FROM module_templates"):
        category = module_category(mt)
        slots = _decode(mt.get("stats_json"), {}) or {}
        compat = [category]
        raw = str(mt.get("slot_type") or "").lower()
        if raw and raw not in compat:
            compat.append(raw)
        conn.execute(
            """INSERT INTO module_definitions (code,category,tier,compatible_slot_categories_json,updated_at)
               VALUES (?,?,?,?,?)
               ON CONFLICT(code) DO UPDATE SET category=excluded.category,tier=excluded.tier,
                 compatible_slot_categories_json=excluded.compatible_slot_categories_json,updated_at=excluded.updated_at""",
            (mt.get("code"), category, int(mt.get("tier") or 1), _json(compat), now),
        )


def module_category(module: Dict[str, Any]) -> str:
    code = str(module.get("code") or module.get("item_code") or "").lower()
    name = str(module.get("name") or "").lower()
    slot = str(module.get("slot_type") or "").lower()
    stats = _decode(module.get("stats_json"), {}) if isinstance(module.get("stats_json"), str) else (module.get("stats") or {})
    if slot == "weapon" or any(k in code for k in ("railgun", "plasma", "missile", "lance", "flak", "turret")) or stats.get("damage"):
        return "weapon"
    if "target" in code or "scanner" in code or "scan" in code or "radar" in code or stats.get("scanning") or stats.get("radar_strength"):
        return "scanner" if "target" not in code else "targeting"
    if "mining" in code or "drill" in code or stats.get("mining"):
        return "mining"
    if "refin" in code:
        return "refining"
    if "craft" in code or "production" in code:
        return "crafting"
    if "cargo" in code or stats.get("cargo"):
        return "cargo"
    if "shield" in code or stats.get("shield") or slot == "shield":
        return "shield"
    if "armor" in code or stats.get("armor") or slot == "armor":
        return "armor"
    if "stealth" in code or "signature" in code or "silent" in code or stats.get("smuggling"):
        return "stealth"
    if "fuel" in code:
        return "fuel"
    if "jump" in code or "drive" in code or slot in {"engine", "core"}:
        return "engine"
    if "repair" in code or "med" in code or stats.get("repair"):
        return "repair"
    return "utility"


def allocation_summary(conn: sqlite3.Connection, player_id: int) -> Dict[str, Any]:
    ensure_player_rows(conn, player_id)
    totals = {k: 0 for k in TREE_ORDER}
    for r in _rows(conn, """
        SELECT n.tree_key, SUM(a.spent_sp) as spent
        FROM player_skill_allocations a
        JOIN progression_skill_nodes n ON n.key=a.node_key
        WHERE a.player_id=?
        GROUP BY n.tree_key
    """, (int(player_id),)):
        totals[str(r["tree_key"])] = int(r.get("spent") or 0)
    total_spent = sum(totals.values())
    allocations = {}
    t4_count = 0
    for key in TREE_ORDER:
        pct = round((totals[key] / max(1, total_spent)) * 100, 1) if total_spent else 0.0
        tier = 1
        if pct >= 65:
            tier = 4
        elif pct >= 40:
            tier = 3
        elif pct >= 20:
            tier = 2
        if tier >= 4:
            t4_count += 1
        allocations[key] = {"spent": totals[key], "allocationPct": pct, "tier": tier, "lowInvestment": pct < 25}
    conn.execute("UPDATE player_progression SET tree_totals_json=?, updated_at=? WHERE player_id=?", (_json(totals), _utc(), int(player_id)))
    return {"totals": totals, "totalSpent": total_spent, "allocations": allocations, "t4Count": t4_count}


def respec_cost(respec_count: int) -> int:
    count = int(respec_count or 0)
    if count <= 0:
        return 0
    return min(int(RESPEC_BASE_COST * (2 ** (count - 1))), RESPEC_HARD_CAP)


def build_progression_state(conn: sqlite3.Connection, player: Dict[str, Any]) -> Dict[str, Any]:
    pid = int(player["id"])
    ensure_progression_content(conn)
    ensure_player_rows(conn, pid)
    prog = _row(conn, "SELECT * FROM player_progression WHERE player_id=?", (pid,)) or {}
    summary = allocation_summary(conn, pid)
    ranks = {r["node_key"]: int(r["ranks"] or 0) for r in _rows(conn, "SELECT node_key,ranks FROM player_skill_allocations WHERE player_id=?", (pid,))}
    branches = _rows(conn, "SELECT * FROM skill_branches ORDER BY tree_key, sort_order")
    nodes = _rows(conn, "SELECT * FROM progression_skill_nodes ORDER BY tree_key, branch_key, sort_order")
    branch_nodes: Dict[str, List[Dict[str, Any]]] = {}
    for n in nodes:
        rank = ranks.get(n["key"], 0)
        branch_nodes.setdefault(n["branch_key"], []).append({
            "key": n["key"], "name": n["name"], "description": n["description"], "rank": rank,
            "maxRank": int(n["max_rank"]), "spCost": int(n["sp_cost"]), "effects": _decode(n["effects_json"], {}),
            "isKeystone": bool(int(n.get("is_keystone") or 0)), "canRank": rank < int(n["max_rank"]) and int(prog.get("unspent_sp") or 0) >= int(n["sp_cost"]),
        })
    branch_payload: Dict[str, List[Dict[str, Any]]] = {}
    for b in branches:
        branch_payload.setdefault(b["tree_key"], []).append({
            "key": b["key"], "name": b["name"], "bonuses": _decode(b["bonuses_json"], []),
            "keystoneName": b["keystone_name"], "keystoneDescription": b["keystone_description"],
            "nodes": branch_nodes.get(b["key"], []),
        })
    trees = []
    tree_rows = {t["key"]: t for t in _rows(conn, "SELECT * FROM skill_trees")}
    for key in TREE_ORDER:
        t = tree_rows.get(key) or {"key": key, "name": key.title(), "purpose": ""}
        a = summary["allocations"][key]
        trees.append({
            "key": key, "name": t["name"], "purpose": t["purpose"], "allocationPct": a["allocationPct"],
            "spent": a["spent"], "tier": a["tier"], "branches": branch_payload.get(key, []),
            "lowInvestmentPenalties": _decode(t.get("low_investment_penalties_json"), []),
            "lowInvestmentActive": bool(a["lowInvestment"] and summary["totalSpent"] > 0),
        })
    next_cost = respec_cost(int(prog.get("respec_count") or 0))
    return {
        "totalSP": int(prog.get("total_sp") or 0),
        "unspentSP": int(prog.get("unspent_sp") or 0),
        "spentSP": summary["totalSpent"],
        "trees": trees,
        "allocations": summary["allocations"],
        "onlyOneT4": True,
        "wouldCreateInvalidT4Warning": summary["t4Count"] > 1,
        "respec": {"count": int(prog.get("respec_count") or 0), "firstFree": int(prog.get("respec_count") or 0) == 0, "nextCost": next_cost, "hardCap": RESPEC_HARD_CAP, "lastRespecAt": prog.get("last_respec_at"), "totalCostPaid": int(prog.get("total_respec_cost_paid") or 0)},
        "caps": CAPS,
        "explanations": [
            "Ships define role identity; modules enhance the ship role.",
            "Only one role can reach T4.",
            "Generalists are viable, but specialists dominate high-tier role content.",
            "Materials, items, ships, and equipment stay tied to their physical storage rules.",
            "Market progression never creates passive income.",
        ],
        "shipEligibility": build_ship_eligibility(conn, pid),
        "effects": progression_effects(conn, pid),
    }


def progression_effects(conn: sqlite3.Connection, player_id: int) -> Dict[str, Any]:
    effects: Dict[str, float] = {}
    for r in _rows(conn, """
        SELECT a.ranks, n.effects_json
        FROM player_skill_allocations a
        JOIN progression_skill_nodes n ON n.key=a.node_key
        WHERE a.player_id=?
    """, (int(player_id),)):
        for key, val in (_decode(r.get("effects_json"), {}) or {}).items():
            if key == "keystone":
                continue
            effects[key] = effects.get(key, 0.0) + float(val or 0) * int(r.get("ranks") or 0)
    for key, cap in CAPS.items():
        if key in effects:
            effects[key] = min(float(cap), effects[key])
    summary = allocation_summary(conn, player_id)
    penalties = []
    for tree, item in summary["allocations"].items():
        if item["lowInvestment"] and summary["totalSpent"] > 0:
            penalties.append({"tree": tree, "allocationPct": item["allocationPct"], "penalties": (_row(conn, "SELECT low_investment_penalties_json FROM skill_trees WHERE key=?", (tree,)) or {}).get("low_investment_penalties_json", "[]")})
    return {"bonuses": effects, "lowInvestmentPenalties": penalties, "pvpDamageBuffs": False}


def spend_sp(conn: sqlite3.Connection, player: Dict[str, Any], node_key: str, ranks: int = 1) -> Dict[str, Any]:
    pid = int(player["id"])
    ensure_progression_content(conn)
    ensure_player_rows(conn, pid)
    node = _row(conn, "SELECT * FROM progression_skill_nodes WHERE key=?", (str(node_key),))
    if not node:
        raise HTTPException(404, "Skill node not found")
    current = _row(conn, "SELECT * FROM player_skill_allocations WHERE player_id=? AND node_key=?", (pid, node["key"])) or {"ranks": 0, "spent_sp": 0}
    add = max(1, int(ranks or 1))
    if int(current.get("ranks") or 0) + add > int(node["max_rank"]):
        raise HTTPException(400, "Node is already at max rank")
    cost = int(node["sp_cost"] or 1) * add
    prog = _row(conn, "SELECT * FROM player_progression WHERE player_id=?", (pid,))
    if int((prog or {}).get("unspent_sp") or 0) < cost:
        raise HTTPException(400, "Not enough SP")
    before = dict(current)
    next_ranks = int(current.get("ranks") or 0) + add
    next_spent = int(current.get("spent_sp") or 0) + cost
    conn.execute(
        """INSERT INTO player_skill_allocations (player_id,node_key,ranks,spent_sp,updated_at)
           VALUES (?,?,?,?,?)
           ON CONFLICT(player_id,node_key) DO UPDATE SET ranks=excluded.ranks,spent_sp=excluded.spent_sp,updated_at=excluded.updated_at""",
        (pid, node["key"], next_ranks, next_spent, _utc()),
    )
    conn.execute("UPDATE player_progression SET unspent_sp=unspent_sp-?, updated_at=? WHERE player_id=?", (cost, _utc(), pid))
    summary = allocation_summary(conn, pid)
    if summary["t4Count"] > 1:
        conn.execute("UPDATE player_progression SET unspent_sp=unspent_sp+?, updated_at=? WHERE player_id=?", (cost, _utc(), pid))
        if int(before.get("ranks") or 0):
            conn.execute("UPDATE player_skill_allocations SET ranks=?, spent_sp=?, updated_at=? WHERE player_id=? AND node_key=?", (before["ranks"], before["spent_sp"], _utc(), pid, node["key"]))
        else:
            conn.execute("DELETE FROM player_skill_allocations WHERE player_id=? AND node_key=?", (pid, node["key"]))
        raise HTTPException(400, "Tree would exceed T4 limit")
    return {"message": f"Spent {cost} SP on {node['name']}.", "node": node["key"], "rank": next_ranks, "progression": build_progression_state(conn, player)}


def player_at_station(conn: sqlite3.Connection, player: Dict[str, Any]) -> bool:
    if player.get("travel_until") or player.get("travel_mode"):
        return False
    planet = _row(conn, "SELECT * FROM planets WHERE id=?", (int(player.get("location_planet_id") or 0),))
    if not planet:
        return False
    text = f"{planet.get('name','')} {planet.get('type','')}".lower()
    return any(k in text for k in ("station", "prime", "hub", "port", "gate", "yard", "world", "colony"))


def respec(conn: sqlite3.Connection, player: Dict[str, Any], god: bool = False) -> Dict[str, Any]:
    pid = int(player["id"])
    ensure_progression_content(conn)
    ensure_player_rows(conn, pid)
    if not player_at_station(conn, player) and not god:
        raise HTTPException(400, "Respec must be done at a station")
    prog = _row(conn, "SELECT * FROM player_progression WHERE player_id=?", (pid,)) or {}
    cost = respec_cost(int(prog.get("respec_count") or 0))
    if cost > int(player.get("credits") or 0) and not god:
        raise HTTPException(400, f"Not enough credits for respec cost {cost}")
    allocations = {r["node_key"]: int(r["ranks"] or 0) for r in _rows(conn, "SELECT node_key,ranks FROM player_skill_allocations WHERE player_id=?", (pid,))}
    refund = int(prog.get("total_sp") or 0)
    if cost and not god:
        conn.execute("UPDATE players SET credits=credits-? WHERE id=?", (cost, pid))
    conn.execute("DELETE FROM player_skill_allocations WHERE player_id=?", (pid,))
    conn.execute(
        "UPDATE player_progression SET unspent_sp=?, tree_totals_json=?, respec_count=respec_count+1, last_respec_at=?, total_respec_cost_paid=total_respec_cost_paid+?, updated_at=? WHERE player_id=?",
        (refund, _json({k: 0 for k in TREE_ORDER}), _utc(), cost, _utc(), pid),
    )
    conn.execute("INSERT INTO player_respec_history (player_id,cost,free,allocations_json,created_at) VALUES (?,?,?,?,?)", (pid, cost, 1 if cost == 0 else 0, _json(allocations), _utc()))
    return {"message": "Respec complete." if cost else "First respec complete for free.", "cost": cost, "progression": build_progression_state(conn, player)}


def ship_template_eligibility(conn: sqlite3.Connection, player_id: int, template: Dict[str, Any]) -> Dict[str, Any]:
    sync_ship_and_module_definitions(conn)
    code = str(template.get("code") or template.get("template_code") or "")
    definition = _row(conn, "SELECT * FROM ship_definitions WHERE code=?", (code,))
    if not definition:
        return {"eligible": True, "reason": "", "requirements": []}
    summary = allocation_summary(conn, player_id)
    required = _decode(definition.get("required_allocation_json"), {}) or {}
    requirements = []
    blockers = []
    for tree, pct in required.items():
        actual = float(summary["allocations"].get(tree, {}).get("allocationPct") or 0)
        ok = actual >= float(pct)
        requirements.append({"tree": tree, "requiredPct": float(pct), "actualPct": round(actual, 1), "met": ok})
        if not ok:
            blockers.append(f"Ship requires {int(pct)}% {tree.title()}")
    return {
        "eligible": not blockers,
        "reason": "; ".join(blockers),
        "requirements": requirements,
        "definition": {
            "role": definition["role"], "tier": int(definition["tier"]),
            "allowedModuleCategories": _decode(definition["allowed_module_categories_json"], []),
            "maxModuleTier": int(definition["max_module_tier"]),
            "hybrid": bool(int(definition.get("hybrid") or 0)),
            "scalingCoefficients": _decode(definition["scaling_coefficients_json"], {}),
        },
    }


def validate_ship_eligibility(conn: sqlite3.Connection, player_id: int, ship_code: str, god: bool = False) -> None:
    if god:
        return
    template = _row(conn, "SELECT * FROM ship_templates WHERE code=?", (str(ship_code),))
    if not template:
        raise HTTPException(404, "Ship not found")
    eligibility = ship_template_eligibility(conn, player_id, template)
    if not eligibility["eligible"]:
        raise HTTPException(400, eligibility["reason"])


def build_ship_eligibility(conn: sqlite3.Connection, player_id: int) -> Dict[str, Any]:
    sync_ship_and_module_definitions(conn)
    out = {}
    for st in _rows(conn, "SELECT * FROM ship_templates ORDER BY ship_tier, price"):
        out[st["code"]] = ship_template_eligibility(conn, player_id, st)
    return out


def module_compatibility(conn: sqlite3.Connection, player_id: int, ship: Dict[str, Any], module: Dict[str, Any]) -> Dict[str, Any]:
    sync_ship_and_module_definitions(conn)
    template = _row(conn, "SELECT code FROM ship_templates WHERE id=?", (int(ship.get("template_id") or 0),))
    ship_def = _row(conn, "SELECT * FROM ship_definitions WHERE code=?", ((template or {}).get("code"),))
    mod_def = _row(conn, "SELECT * FROM module_definitions WHERE code=?", (str(module.get("code") or ""),))
    category = (mod_def or {}).get("category") or module_category(module)
    allowed = _decode((ship_def or {}).get("allowed_module_categories_json"), role_module_categories(ship.get("role"))) or []
    blockers = []
    ship_tier = int(ship.get("current_tier") or ship.get("ship_tier") or 1)
    module_tier = int(module.get("current_tier") or module.get("template_tier") or module.get("tier") or 1)
    if module_tier > ship_tier:
        blockers.append("Module tier exceeds ship tier")
    max_module_tier = int((ship_def or {}).get("max_module_tier") or ship_tier)
    if module_tier > max_module_tier:
        blockers.append("Module tier exceeds ship max module tier")
    if category not in allowed:
        blockers.append("Module category not allowed on this ship")
    return {"compatible": not blockers, "reasons": blockers, "category": category, "allowedCategories": allowed, "moduleTier": module_tier, "shipTier": ship_tier}


def validate_module_compatibility(conn: sqlite3.Connection, player_id: int, ship: Dict[str, Any], module: Dict[str, Any], god: bool = False) -> None:
    if god:
        return
    compat = module_compatibility(conn, player_id, ship, module)
    if not compat["compatible"]:
        raise HTTPException(400, "; ".join(compat["reasons"]))

