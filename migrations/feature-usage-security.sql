-- ============================================================
-- 사용량 추적 보안 강화:
--   1) feature_usage_daily 테이블 RLS 활성화
--   2) increment_feature_usage RPC 권한 좁히기 (PUBLIC 제거, service_role 만)
--   3) RPC 의 동적 interval 인터폴레이션 → make_interval 로 교체
-- ============================================================

-- 0) 옛 오버로드 정리 (3-arg 버전이 anon/authenticated EXECUTE 권한 남아 있던 문제)
DROP FUNCTION IF EXISTS increment_feature_usage(date, text, text);

-- 1) RLS 활성화 + 정책 (service_role 은 전부 통과, 그 외 차단)
ALTER TABLE feature_usage_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feature_usage_service_all ON feature_usage_daily;
CREATE POLICY feature_usage_service_all
  ON feature_usage_daily
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2) RPC 권한 좁히기. anon/authenticated 가 직접 호출 못 하도록.
REVOKE ALL ON FUNCTION increment_feature_usage(date, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION increment_feature_usage(date, text, text, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_feature_usage(date, text, text, integer) TO service_role;

-- 3) RPC 재정의: make_interval 로 안전하게 ms → interval, search_path 고정
CREATE OR REPLACE FUNCTION increment_feature_usage(
  p_date         DATE,
  p_manager      TEXT,
  p_feature      TEXT,
  p_throttle_ms  INTEGER DEFAULT 0
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO feature_usage_daily (usage_date, manager, feature, count, last_used_at)
  VALUES (p_date, p_manager, p_feature, 1, NOW())
  ON CONFLICT (usage_date, manager, feature)
  DO UPDATE SET
    count = feature_usage_daily.count + CASE
      WHEN p_throttle_ms > 0
       AND feature_usage_daily.last_used_at >
           NOW() - make_interval(secs => p_throttle_ms / 1000.0)
      THEN 0
      ELSE 1
    END,
    last_used_at = NOW();
END;
$$;

-- 재정의 후 권한 다시 적용 (CREATE OR REPLACE 가 owner 기준 권한 초기화 함)
REVOKE ALL ON FUNCTION increment_feature_usage(date, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION increment_feature_usage(date, text, text, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_feature_usage(date, text, text, integer) TO service_role;
