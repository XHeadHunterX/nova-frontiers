import sqlite3
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app import main


def make_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(
        """
        CREATE TABLE planets (
          id INTEGER PRIMARY KEY,
          security_level INTEGER NOT NULL DEFAULT 50
        );
        CREATE TABLE players (
          id INTEGER PRIMARY KEY,
          level INTEGER NOT NULL DEFAULT 1,
          xp INTEGER NOT NULL DEFAULT 0,
          skill_points INTEGER NOT NULL DEFAULT 0,
          location_planet_id INTEGER NOT NULL
        );
        CREATE TABLE player_xp_action_history (
          player_id INTEGER NOT NULL,
          action_key TEXT NOT NULL,
          action_signature TEXT NOT NULL,
          window_start TEXT NOT NULL,
          repeat_count INTEGER NOT NULL DEFAULT 0,
          last_awarded_at TEXT NOT NULL,
          PRIMARY KEY (player_id, action_key, action_signature)
        );
        CREATE TABLE player_skills (
          player_id INTEGER NOT NULL,
          skill_key TEXT NOT NULL,
          level INTEGER NOT NULL DEFAULT 0,
          xp INTEGER NOT NULL DEFAULT 0,
          updated_at TEXT NOT NULL DEFAULT '',
          PRIMARY KEY (player_id, skill_key)
        );
        """
    )
    conn.execute("INSERT INTO planets (id, security_level) VALUES (1, 50)")
    conn.execute("INSERT INTO players (id, level, xp, skill_points, location_planet_id) VALUES (1, 1, 0, 4, 1)")
    return conn


class UniversalProgressionTests(unittest.TestCase):
    def test_valid_actions_grant_universal_xp(self):
        conn = make_conn()
        award = main.add_universal_xp(conn, 1, "mining", time_seconds=60, difficulty=1, participation=1, signature="mine:test", share_party=False)
        self.assertGreater(award["xp"], 0)
        player = main.get_player(conn, 1)
        self.assertEqual(player["xp"], award["xp"])

    def test_gold_item_and_recipe_movement_do_not_grant_xp(self):
        conn = make_conn()
        for action in ("gold_transfer", "loot_drop", "recipe_drop", "market_listing", "market_cancel"):
            award = main.add_universal_xp(conn, 1, action, base_amount=999, participation=1, signature=action)
            self.assertEqual(award["xp"], 0)
        self.assertEqual(main.get_player(conn, 1)["xp"], 0)

    def test_repetition_decay_reduces_repeated_safe_action(self):
        conn = make_conn()
        awards = [
            main.add_universal_xp(conn, 1, "mining", time_seconds=60, signature="same-rock", share_party=False)["xp"]
            for _ in range(5)
        ]
        self.assertGreater(awards[0], awards[-1])

    def test_salvage_materials_never_include_recipes(self):
        conn = make_conn()
        mats = main.salvage_materials_for_ship(
            conn,
            {"id": "npc:1", "role": "pirate", "level": 5, "name": "Pirate"},
            {"name": "Pirate Frigate", "role": "pirate", "tier": 2, "hull": 2000, "shield": 500, "combatRating": 250},
        )
        self.assertFalse(any("recipe" in str(code).lower() for code in mats))

    def test_skill_tree_limits_use_universal_skill_points(self):
        conn = make_conn()
        conn.execute("INSERT INTO player_skills (player_id, skill_key, level) VALUES (1, 'combat', 3)")
        conn.execute("INSERT INTO player_skills (player_id, skill_key, level) VALUES (1, 'mining', 3)")
        ok, _ = main.can_invest_skill_tree(conn, 1, "Exploration", 3)
        self.assertFalse(ok)
        ok, _ = main.can_invest_skill_tree(conn, 1, "Combat", 4)
        self.assertTrue(ok)

    def test_player_facing_ui_has_no_categorized_xp_labels(self):
        ui = Path(__file__).resolve().parents[1] / "frontend" / "src" / "main.jsx"
        text = ui.read_text(encoding="utf-8")
        banned = ["Combat XP", "Mining XP", "Exploration XP", "Industry XP", "Market XP"]
        self.assertFalse([label for label in banned if label in text])


if __name__ == "__main__":
    unittest.main()
