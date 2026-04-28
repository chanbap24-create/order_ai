-- ============================================================
-- 사용량 카운터 throttle: 같은 (date, manager, feature) 가 최근 N ms 내
-- 다시 호출되면 last_used_at 만 갱신하고 count 는 증가시키지 않음.
-- 페이지 로드시 다발 호출 / 디바운스 검색 등에서 1회 클릭 = 1회 카운트 보장.
-- ============================================================

CREATE OR REPLACE FUNCTION increment_feature_usage(
  p_date         DATE,
  p_manager      TEXT,
  p_feature      TEXT,
  p_throttle_ms  INTEGER DEFAULT 0
) RETURNS VOID AS $$
BEGIN
  INSERT INTO feature_usage_daily (usage_date, manager, feature, count, last_used_at)
  VALUES (p_date, p_manager, p_feature, 1, NOW())
  ON CONFLICT (usage_date, manager, feature)
  DO UPDATE SET
    count = feature_usage_daily.count + CASE
      WHEN p_throttle_ms > 0
       AND feature_usage_daily.last_used_at > NOW() - (p_throttle_ms || ' milliseconds')::interval
      THEN 0
      ELSE 1
    END,
    last_used_at = NOW();
END;
$$ LANGUAGE plpgsql;
