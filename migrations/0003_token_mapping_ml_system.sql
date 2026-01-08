-- ========================================
-- Stage 1: 토큰 매핑 학습 시스템 스키마
-- ========================================

-- 1. 토큰 매핑 테이블 (즉시 활용)
CREATE TABLE IF NOT EXISTS token_mapping (
  token TEXT PRIMARY KEY,              -- "ch", "bl", "lc", "샤도", "까베"
  mapped_text TEXT NOT NULL,           -- "찰스하이직", "로쉬벨렌", "샤르도네"
  token_type TEXT DEFAULT 'producer',  -- producer, varietal, region, vintage
  confidence REAL DEFAULT 0.5,         -- 학습 횟수 기반 신뢰도 (0.0 ~ 1.0)
  learned_count INTEGER DEFAULT 1,     -- 학습 횟수
  last_used_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_token_mapping_type ON token_mapping(token_type);
CREATE INDEX IF NOT EXISTS idx_token_mapping_confidence ON token_mapping(confidence DESC);

-- 2. ML 학습용 데이터 수집 (PyTorch 전환 준비)
CREATE TABLE IF NOT EXISTS ml_training_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,                 -- "ch 샤르도네 24병"
  query_normalized TEXT NOT NULL,      -- "ch 샤르도네"
  selected_item_no TEXT NOT NULL,      -- "3A24401"
  selected_item_name TEXT NOT NULL,    -- "찰스하이직 샤르도네 2022"
  rejected_items TEXT,                 -- JSON: ["3B12345", "3C67890"]
  client_code TEXT,
  features TEXT,                       -- JSON: {recent: 0.8, freq: 0.9, vintage: 0.7}
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ml_training_query ON ml_training_data(query_normalized);
CREATE INDEX IF NOT EXISTS idx_ml_training_client ON ml_training_data(client_code);
CREATE INDEX IF NOT EXISTS idx_ml_training_date ON ml_training_data(created_at);

-- 3. 토큰 출현 빈도 (자동 생성, 분석용)
CREATE TABLE IF NOT EXISTS token_frequency (
  token TEXT NOT NULL,
  item_no TEXT NOT NULL,
  frequency INTEGER DEFAULT 1,
  last_seen TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token, item_no)
);

CREATE INDEX IF NOT EXISTS idx_token_freq_token ON token_frequency(token);
CREATE INDEX IF NOT EXISTS idx_token_freq_item ON token_frequency(item_no);
