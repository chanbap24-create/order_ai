CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  client_code TEXT NOT NULL,
  client_name TEXT NOT NULL DEFAULT '',
  payment_date DATE NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  manager TEXT DEFAULT '',
  department TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_client_code ON payments(client_code);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
