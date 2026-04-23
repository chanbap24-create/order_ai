-- ============================================================
-- user_preferences: 계정별 UI 설정 저장 (디바이스 간 동기화용)
-- 견적 컬럼, 재고 컬럼, 문서 설정, 활성 탭 등
-- key는 자유 형식이지만 권장 예:
--   'inventory_columns_cdv', 'inventory_columns_dl'
--   'quote_company', 'quote_doc_settings_CDV', 'quote_doc_settings_DL'
--   'quote_visible_columns_CDV', 'quote_visible_columns_DL'
-- ============================================================

CREATE TABLE IF NOT EXISTS user_preferences (
  manager TEXT NOT NULL REFERENCES sales_users(manager) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (manager, key)
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_manager
  ON user_preferences(manager);
