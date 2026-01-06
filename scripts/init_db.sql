PRAGMA journal_mode=WAL;

DROP TABLE IF EXISTS shipments;
DROP TABLE IF EXISTS client_alias;
DROP TABLE IF EXISTS client_item_stats;

CREATE TABLE shipments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_name TEXT,
  client_code TEXT,
  ship_date TEXT,
  item_no TEXT,
  item_name TEXT,
  unit_price REAL
);

CREATE INDEX idx_shipments_client_code ON shipments(client_code);
CREATE INDEX idx_shipments_client_name ON shipments(client_name);
CREATE INDEX idx_shipments_item_no ON shipments(item_no);
CREATE INDEX idx_shipments_ship_date ON shipments(ship_date);

CREATE TABLE client_alias (
  alias TEXT PRIMARY KEY,
  client_code TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_client_alias_code ON client_alias(client_code);

CREATE TABLE client_item_stats (
  client_code TEXT NOT NULL,
  item_no TEXT NOT NULL,
  item_name TEXT NOT NULL,
  last_ship_date TEXT,
  buy_count INTEGER NOT NULL,
  avg_price REAL,
  PRIMARY KEY (client_code, item_no)
);

CREATE INDEX idx_client_item_stats_code ON client_item_stats(client_code);
