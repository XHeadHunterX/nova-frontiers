-- Nova Frontiers final-stack preparation.
-- Additive only: creates tables and indexes. No drops, renames, destructive updates,
-- required backfills, or NOT NULL changes to existing tables.
-- The Python startup migration applies equivalent guarded DDL and skips indexes
-- if an older local database lacks the referenced optional columns.

CREATE TABLE IF NOT EXISTS platform_linked_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  display_name TEXT,
  email TEXT,
  linked_at TEXT NOT NULL,
  last_seen_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(provider, provider_account_id)
);

CREATE TABLE IF NOT EXISTS subscription_entitlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT 'manual',
  external_subscription_id TEXT,
  tier TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'inactive',
  starts_at TEXT,
  expires_at TEXT,
  benefits_json TEXT NOT NULL DEFAULT '{}',
  validation_record_id INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_validation_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  external_receipt_id TEXT,
  external_transaction_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  request_hash TEXT,
  response_json TEXT NOT NULL DEFAULT '{}',
  validated_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscription_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  platform TEXT NOT NULL DEFAULT 'system',
  action TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  reason TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS worker_job_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'started',
  locked_by TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  duration_ms INTEGER,
  error_message TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_final_players_user ON players(user_id);
CREATE INDEX IF NOT EXISTS idx_final_players_callsign ON players(callsign);
CREATE INDEX IF NOT EXISTS idx_final_players_location ON players(location_planet_id);
CREATE INDEX IF NOT EXISTS idx_final_sessions_user_last_seen ON sessions(user_id, last_seen_at);
CREATE INDEX IF NOT EXISTS idx_final_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_final_planets_galaxy_location ON planets(galaxy_id, x, y);
CREATE INDEX IF NOT EXISTS idx_final_combat_player_status ON combat_battles(player_id, status);
CREATE INDEX IF NOT EXISTS idx_final_combat_status_updated ON combat_battles(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_final_combat_planet_status ON combat_battles(planet_id, status);
CREATE INDEX IF NOT EXISTS idx_final_inventory_player_item ON inventory(player_id, item_code);
CREATE INDEX IF NOT EXISTS idx_final_inventory_player_category ON inventory(player_id, category);
CREATE INDEX IF NOT EXISTS idx_final_cargo_player_commodity ON cargo_hold(player_id, commodity_id);
CREATE INDEX IF NOT EXISTS idx_final_market_planet_prices ON market_prices(planet_id, commodity_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_final_listings_planet_status ON player_market_listings(planet_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_final_listings_item_status ON player_market_listings(item_code, status);
CREATE INDEX IF NOT EXISTS idx_final_events_player_created ON events(player_id, created_at);
CREATE INDEX IF NOT EXISTS idx_final_events_category_created ON events(category, created_at);
CREATE INDEX IF NOT EXISTS idx_final_server_events_status_time ON server_events(status, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_final_leaderboard_rows_player_rank ON leaderboard_snapshot_rows(player_id, rank);
CREATE INDEX IF NOT EXISTS idx_final_leaderboard_current_period ON leaderboard_snapshots(is_current, period, metric_key);
CREATE INDEX IF NOT EXISTS idx_final_platform_accounts_user ON platform_linked_accounts(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_final_entitlements_player_status ON subscription_entitlements(player_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_final_entitlements_user_status ON subscription_entitlements(user_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_final_payment_records_player ON payment_validation_records(player_id, platform, created_at);
CREATE INDEX IF NOT EXISTS idx_final_subscription_audit_player ON subscription_audit_logs(player_id, created_at);
CREATE INDEX IF NOT EXISTS idx_final_worker_job_runs ON worker_job_runs(job_key, status, started_at);
