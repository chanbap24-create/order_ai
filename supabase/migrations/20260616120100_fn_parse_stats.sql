-- order-v2 파싱 에스컬레이션 비율·비용 집계 (최근 p_days일)
-- 비용 단가($/Mtok, 추정): Haiku in 1.0 / cache_read 0.10 / out 5.0,
--                          Sonnet in 3.0 / cache_read 0.30 / out 15.0
CREATE OR REPLACE FUNCTION public.fn_parse_stats(p_days int DEFAULT 30)
RETURNS json
LANGUAGE sql
STABLE
AS $$
  WITH rows AS (
    SELECT * FROM public.order_parse_log
    WHERE created_at >= now() - make_interval(days => p_days)
  ),
  costed AS (
    SELECT
      tab, escalated, created_at,
      ((base_input - base_cache_read) * 1.0 + base_cache_read * 0.10 + base_output * 5.0) / 1e6 AS base_cost,
      ((esc_input - esc_cache_read) * 3.0 + esc_cache_read * 0.30 + esc_output * 15.0) / 1e6 AS esc_cost
    FROM rows
  )
  SELECT json_build_object(
    'days', p_days,
    'total', (SELECT count(*) FROM rows),
    'escalated', (SELECT count(*) FROM rows WHERE escalated),
    'baseCost', COALESCE((SELECT sum(base_cost) FROM costed), 0),
    'escalationCost', COALESCE((SELECT sum(esc_cost) FROM costed), 0),
    'totalCost', COALESCE((SELECT sum(base_cost + esc_cost) FROM costed), 0),
    'byTab', (SELECT COALESCE(json_object_agg(tab, t), '{}'::json) FROM (
        SELECT COALESCE(tab, '?') AS tab,
               json_build_object('total', count(*), 'escalated', count(*) FILTER (WHERE escalated)) AS t
        FROM rows GROUP BY 1
      ) s),
    'byDay', (SELECT COALESCE(json_agg(d ORDER BY d->>'date'), '[]'::json) FROM (
        SELECT json_build_object(
          'date', to_char(date_trunc('day', created_at), 'YYYY-MM-DD'),
          'total', count(*),
          'escalated', count(*) FILTER (WHERE escalated)
        ) AS d
        FROM costed GROUP BY date_trunc('day', created_at)
      ) s2)
  );
$$;
