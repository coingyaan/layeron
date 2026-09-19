-- Rebuildable from onchain events. Chain is source of truth; this is a cache/index.
CREATE TABLE IF NOT EXISTS users (
  address        TEXT PRIMARY KEY,
  xp             BIGINT NOT NULL DEFAULT 0,
  streak         INT    NOT NULL DEFAULT 0,
  longest_streak INT    NOT NULL DEFAULT 0,
  total_gms      INT    NOT NULL DEFAULT 0,
  last_xp_day    INT,
  first_seen     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS gms (
  chain_id     BIGINT NOT NULL,
  tx_hash      TEXT   NOT NULL,
  log_index    INT    NOT NULL,
  address      TEXT   NOT NULL,
  utc_day      INT    NOT NULL,
  fee          BIGINT NOT NULL,
  xp_awarded   BIGINT NOT NULL,
  block_number BIGINT NOT NULL,
  ts           TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (chain_id, tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS gms_address_idx ON gms(address);
CREATE INDEX IF NOT EXISTS gms_utcday_idx  ON gms(utc_day);
CREATE INDEX IF NOT EXISTS gms_month_idx   ON gms((to_char(ts,'YYYY-MM')));
CREATE INDEX IF NOT EXISTS gms_xp_idx      ON gms(xp_awarded);
-- audit log for config/admin events (FeeUpdated, WalletUpdated, XPUpdated, Paused, ChainUpdated...)
CREATE TABLE IF NOT EXISTS admin_events (
  chain_id BIGINT, tx_hash TEXT, log_index INT, name TEXT, args JSONB, block_number BIGINT, ts TIMESTAMPTZ,
  PRIMARY KEY (chain_id, tx_hash, log_index)
);
CREATE TABLE IF NOT EXISTS indexer_cursor ( chain_id BIGINT PRIMARY KEY, last_block BIGINT NOT NULL );
