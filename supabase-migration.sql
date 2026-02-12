-- ============================================================
-- Order AI: SQLite → Supabase Postgres 마이그레이션
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

-- ── 1. 재고 테이블 (inventory) ──

CREATE TABLE IF NOT EXISTS inventory_cdv (
  item_no TEXT PRIMARY KEY,
  item_name TEXT,
  supply_price REAL,
  discount_price REAL,
  wholesale_price REAL,
  retail_price REAL,
  min_price REAL,
  available_stock REAL DEFAULT 0,
  bonded_warehouse REAL DEFAULT 0,
  incoming_stock REAL DEFAULT 0,
  sales_30days REAL DEFAULT 0,
  vintage TEXT,
  alcohol_content TEXT,
  country TEXT
);

CREATE TABLE IF NOT EXISTS inventory_dl (
  item_no TEXT PRIMARY KEY,
  item_name TEXT,
  supply_price REAL,
  available_stock REAL DEFAULT 0,
  anseong_warehouse REAL DEFAULT 0,
  sales_30days REAL DEFAULT 0,
  vintage TEXT,
  alcohol_content TEXT,
  country TEXT
);

-- ── 2. 거래처/출고 테이블 ──

CREATE TABLE IF NOT EXISTS clients (
  client_code TEXT PRIMARY KEY,
  client_name TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shipments (
  id SERIAL PRIMARY KEY,
  client_name TEXT,
  client_code TEXT,
  ship_date TEXT,
  item_no TEXT,
  item_name TEXT,
  unit_price REAL
);
CREATE INDEX IF NOT EXISTS idx_shipments_client_code ON shipments(client_code);
CREATE INDEX IF NOT EXISTS idx_shipments_client_name ON shipments(client_name);
CREATE INDEX IF NOT EXISTS idx_shipments_item_no ON shipments(item_no);
CREATE INDEX IF NOT EXISTS idx_shipments_ship_date ON shipments(ship_date);

CREATE TABLE IF NOT EXISTS client_item_stats (
  client_code TEXT NOT NULL,
  item_no TEXT NOT NULL,
  item_name TEXT NOT NULL,
  last_ship_date TEXT,
  buy_count INTEGER DEFAULT 0,
  avg_price REAL,
  supply_price REAL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (client_code, item_no)
);
CREATE INDEX IF NOT EXISTS idx_client_item_stats_client ON client_item_stats(client_code);

-- ── 3. 학습 테이블 (Learning) ──

CREATE TABLE IF NOT EXISTS item_alias (
  alias TEXT NOT NULL,
  canonical TEXT NOT NULL,
  client_code TEXT NOT NULL DEFAULT '*',
  count INTEGER DEFAULT 1,
  last_used_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (alias, client_code)
);

CREATE TABLE IF NOT EXISTS client_alias (
  client_code TEXT NOT NULL,
  alias TEXT NOT NULL,
  weight INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (client_code, alias)
);
CREATE INDEX IF NOT EXISTS idx_client_alias_code ON client_alias(client_code);

CREATE TABLE IF NOT EXISTS token_mapping (
  token TEXT NOT NULL,
  mapped_text TEXT NOT NULL,
  token_type TEXT DEFAULT 'item',
  confidence REAL DEFAULT 0.5,
  learned_count INTEGER DEFAULT 1,
  last_used TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (token, mapped_text)
);

CREATE TABLE IF NOT EXISTS search_learning (
  search_key TEXT NOT NULL,
  item_no TEXT NOT NULL,
  hit_count INTEGER DEFAULT 1,
  last_used_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (search_key, item_no)
);
CREATE INDEX IF NOT EXISTS idx_search_learning_key ON search_learning(search_key);
CREATE INDEX IF NOT EXISTS idx_search_learning_item ON search_learning(item_no);

CREATE TABLE IF NOT EXISTS ml_training_data (
  id SERIAL PRIMARY KEY,
  query TEXT,
  query_normalized TEXT,
  selected_item_no TEXT,
  selected_item_name TEXT,
  rejected_items TEXT,
  client_code TEXT,
  features TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS token_frequency (
  token TEXT NOT NULL,
  item_no TEXT NOT NULL,
  frequency INTEGER DEFAULT 1,
  last_seen TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (token, item_no)
);

-- ── 4. 견적서 (Quote) ──

CREATE TABLE IF NOT EXISTS quote_items (
  id SERIAL PRIMARY KEY,
  item_code TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  brand TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  vintage TEXT NOT NULL DEFAULT '',
  product_name TEXT NOT NULL DEFAULT '',
  english_name TEXT NOT NULL DEFAULT '',
  korean_name TEXT NOT NULL DEFAULT '',
  supply_price REAL NOT NULL DEFAULT 0,
  retail_price REAL NOT NULL DEFAULT 0,
  discount_rate REAL NOT NULL DEFAULT 0,
  discounted_price REAL NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  note TEXT NOT NULL DEFAULT '',
  tasting_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quote_items_item_code ON quote_items(item_code);

-- ── 5. 와인 관리 테이블 ──

CREATE TABLE IF NOT EXISTS wines (
  item_code TEXT PRIMARY KEY,
  item_name_kr TEXT NOT NULL,
  item_name_en TEXT,
  country TEXT,
  country_en TEXT,
  region TEXT,
  grape_varieties TEXT,
  wine_type TEXT,
  vintage TEXT,
  volume_ml INTEGER,
  alcohol TEXT,
  supplier TEXT,
  supplier_kr TEXT,
  supply_price REAL,
  available_stock REAL,
  status TEXT DEFAULT 'active' CHECK(status IN ('active','new','discontinued')),
  ai_researched INTEGER DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasting_notes (
  id SERIAL PRIMARY KEY,
  wine_id TEXT NOT NULL UNIQUE,
  color_note TEXT,
  nose_note TEXT,
  palate_note TEXT,
  food_pairing TEXT,
  glass_pairing TEXT,
  serving_temp TEXT,
  awards TEXT,
  winemaking TEXT,
  winery_description TEXT,
  vintage_note TEXT,
  aging_potential TEXT,
  ai_generated INTEGER DEFAULT 0,
  manually_edited INTEGER DEFAULT 0,
  approved INTEGER DEFAULT 0,
  ppt_generated INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (wine_id) REFERENCES wines(item_code) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wine_images (
  id SERIAL PRIMARY KEY,
  wine_id TEXT NOT NULL,
  image_type TEXT,
  file_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (wine_id) REFERENCES wines(item_code) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS price_history (
  id SERIAL PRIMARY KEY,
  item_code TEXT NOT NULL,
  field_name TEXT DEFAULT 'supply_price',
  old_value REAL,
  new_value REAL,
  change_pct REAL,
  detected_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS change_logs (
  id SERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 기본 설정
INSERT INTO admin_settings (key, value) VALUES ('low_stock_threshold', '6')
ON CONFLICT (key) DO NOTHING;

-- ── 6. 와인 프로필 ──

CREATE TABLE IF NOT EXISTS wine_profiles (
  item_code TEXT PRIMARY KEY,
  country TEXT DEFAULT '',
  region TEXT DEFAULT '',
  sub_region TEXT DEFAULT '',
  appellation TEXT DEFAULT '',
  grape_varieties TEXT DEFAULT '',
  wine_type TEXT DEFAULT '',
  body TEXT DEFAULT '',
  sweetness TEXT DEFAULT '',
  tasting_aroma TEXT DEFAULT '',
  tasting_palate TEXT DEFAULT '',
  food_pairing TEXT DEFAULT '',
  description_kr TEXT DEFAULT '',
  description_en TEXT DEFAULT '',
  alcohol TEXT DEFAULT '',
  serving_temp TEXT DEFAULT '',
  aging_potential TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wp_country ON wine_profiles(country);
CREATE INDEX IF NOT EXISTS idx_wp_wine_type ON wine_profiles(wine_type);
CREATE INDEX IF NOT EXISTS idx_wp_region ON wine_profiles(region);

-- ── 7. Glass(DL) 창고 테이블 ──

CREATE TABLE IF NOT EXISTS glass_clients (
  client_code TEXT PRIMARY KEY,
  client_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS glass_client_alias (
  client_code TEXT NOT NULL,
  alias TEXT NOT NULL,
  weight INTEGER DEFAULT 10,
  PRIMARY KEY (client_code, alias)
);
CREATE INDEX IF NOT EXISTS idx_glass_client_alias_alias ON glass_client_alias(alias);

CREATE TABLE IF NOT EXISTS glass_items (
  item_no TEXT PRIMARY KEY,
  item_name TEXT NOT NULL,
  supply_price REAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_glass_items_name ON glass_items(item_name);

CREATE TABLE IF NOT EXISTS glass_client_item_stats (
  client_code TEXT NOT NULL,
  item_no TEXT NOT NULL,
  item_name TEXT NOT NULL,
  supply_price REAL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (client_code, item_no)
);
CREATE INDEX IF NOT EXISTS idx_glass_client_item_stats_client ON glass_client_item_stats(client_code);

CREATE TABLE IF NOT EXISTS glass_item_synonyms (
  input_text TEXT NOT NULL,
  item_no TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  learned_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (input_text, item_no)
);
CREATE INDEX IF NOT EXISTS idx_glass_item_synonyms_input ON glass_item_synonyms(input_text);

-- ── 8. English 시트 매칭 테이블 ──

CREATE TABLE IF NOT EXISTS item_english (
  item_no TEXT PRIMARY KEY,
  name_en TEXT
);

-- ── 9. 리델리스트 ──

CREATE TABLE IF NOT EXISTS riedel_items (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL,
  series TEXT DEFAULT '',
  item_kr TEXT DEFAULT '',
  item_en TEXT DEFAULT '',
  unit REAL,
  supply_price REAL,
  box_price REAL,
  note TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_riedel_items_code ON riedel_items(code);

-- ── 10. 와인리스트 (English) ──

CREATE TABLE IF NOT EXISTS wine_list_english (
  item_no TEXT PRIMARY KEY,
  country TEXT DEFAULT '',
  supplier TEXT DEFAULT '',
  region TEXT DEFAULT '',
  wine_name_en TEXT DEFAULT '',
  wine_name_kr TEXT DEFAULT '',
  vintage TEXT DEFAULT '',
  ml REAL,
  supply_price REAL,
  supplier_name TEXT DEFAULT '',
  stock REAL,
  bonded REAL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 마이그레이션 완료!
-- ============================================================
