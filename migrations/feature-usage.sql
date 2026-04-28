-- ============================================================
-- 계정별 기능 사용 카운터 (일자 × 매니저 × 기능)
-- Supabase SQL Editor에서 실행
-- ============================================================

CREATE TABLE IF NOT EXISTS feature_usage_daily (
  usage_date    DATE        NOT NULL,
  manager       TEXT        NOT NULL,
  feature       TEXT        NOT NULL,
  count         INTEGER     NOT NULL DEFAULT 0,
  last_used_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usage_date, manager, feature)
);

CREATE INDEX IF NOT EXISTS idx_feature_usage_daily_date    ON feature_usage_daily(usage_date DESC);
CREATE INDEX IF NOT EXISTS idx_feature_usage_daily_manager ON feature_usage_daily(manager, usage_date DESC);

-- 카운트 +1 (UPSERT). PostgREST RPC로 호출.
CREATE OR REPLACE FUNCTION increment_feature_usage(
  p_date    DATE,
  p_manager TEXT,
  p_feature TEXT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO feature_usage_daily (usage_date, manager, feature, count, last_used_at)
  VALUES (p_date, p_manager, p_feature, 1, NOW())
  ON CONFLICT (usage_date, manager, feature)
  DO UPDATE SET
    count = feature_usage_daily.count + 1,
    last_used_at = NOW();
END;
$$ LANGUAGE plpgsql;
