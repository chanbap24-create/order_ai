-- DL-Client (와인잔) 전용 테이블

-- 거래처 테이블
CREATE TABLE IF NOT EXISTS glass_clients (
  client_code TEXT PRIMARY KEY,
  client_name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 거래처 별칭 테이블 (검색용)
CREATE TABLE IF NOT EXISTS glass_client_alias (
  client_code TEXT NOT NULL,
  alias TEXT NOT NULL,
  weight INTEGER DEFAULT 10,
  PRIMARY KEY (client_code, alias),
  FOREIGN KEY (client_code) REFERENCES glass_clients(client_code)
);

-- 품목 테이블
CREATE TABLE IF NOT EXISTS glass_items (
  item_no TEXT PRIMARY KEY,
  item_name TEXT NOT NULL,
  supply_price REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 거래처별 품목 통계 (거래 이력 기반)
CREATE TABLE IF NOT EXISTS glass_client_item_stats (
  client_code TEXT NOT NULL,
  item_no TEXT NOT NULL,
  item_name TEXT NOT NULL,
  supply_price REAL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (client_code, item_no),
  FOREIGN KEY (client_code) REFERENCES glass_clients(client_code),
  FOREIGN KEY (item_no) REFERENCES glass_items(item_no)
);

-- 품목 별칭 학습 테이블
CREATE TABLE IF NOT EXISTS glass_item_synonyms (
  input_text TEXT NOT NULL,
  item_no TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  learned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (input_text, item_no)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_glass_client_alias_alias ON glass_client_alias(alias);
CREATE INDEX IF NOT EXISTS idx_glass_items_name ON glass_items(item_name);
CREATE INDEX IF NOT EXISTS idx_glass_client_item_stats_client ON glass_client_item_stats(client_code);
CREATE INDEX IF NOT EXISTS idx_glass_item_synonyms_input ON glass_item_synonyms(input_text);
