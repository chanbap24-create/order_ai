CREATE TABLE IF NOT EXISTS client_carryover (
  id SERIAL PRIMARY KEY,
  client_code TEXT NOT NULL UNIQUE,
  client_name TEXT NOT NULL DEFAULT '',
  carryover_amount INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_carryover_code ON client_carryover(client_code);
