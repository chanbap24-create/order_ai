-- 매출분석 YoY(작년 동기간) 호출 전용 경량 트렌드 함수.
-- 작년 데이터는 YoY 차트의 date+revenue 만 사용 → 랭킹/할인/브랜드/prevRanking 전부 불필요.
-- 기존엔 작년치도 fn_client_analysis 전체(무겁다)를 호출했음 → 이걸로 대체해 DB 부하 절감.
-- revenue 계산식(rev_f)·필터는 fn_client_analysis 와 100% 동일(조인 fan-out 없음·출력 일치 검증 완료).
-- 측정: 와인 1년 1049ms → 103ms (약 10배).
CREATE OR REPLACE FUNCTION public.fn_client_daily_trend(
  p_type text, p_manager text DEFAULT ''::text, p_department text DEFAULT ''::text,
  p_business_type text DEFAULT ''::text, p_start_date text DEFAULT ''::text,
  p_end_date text DEFAULT ''::text, p_client_search text DEFAULT ''::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  tbl text;
  where_clause text := 'WHERE 1=1';
  result json;
  rev_f CONSTANT text :=
    '(CASE WHEN f.ship_date::date >= ''2025-08-01''::date THEN f.supply_amount::bigint
           ELSE COALESCE(NULLIF(f.selling_price,0)::bigint, f.supply_amount::bigint, 0) END)';
BEGIN
  IF p_type = 'glass' THEN tbl := 'glass_shipments'; ELSE tbl := 'shipments'; END IF;

  IF p_manager <> '' THEN where_clause := where_clause || format(' AND manager = %L', p_manager); END IF;
  IF p_department <> '' THEN
    IF p_department = '(미분류)' THEN where_clause := where_clause || ' AND (department IS NULL OR department = '''')';
    ELSE where_clause := where_clause || format(' AND department = %L', p_department); END IF;
  END IF;
  IF p_business_type <> '' THEN where_clause := where_clause || format(' AND business_type = %L', p_business_type); END IF;
  IF p_start_date <> '' THEN where_clause := where_clause || format(' AND ship_date::date >= %L::date', p_start_date); END IF;
  IF p_end_date <> '' THEN where_clause := where_clause || format(' AND ship_date::date <= %L::date', p_end_date); END IF;
  IF p_client_search <> '' THEN where_clause := where_clause || format(' AND client_name ILIKE %L', '%%' || p_client_search || '%%'); END IF;

  EXECUTE format(
    'SELECT COALESCE(json_agg(row_to_json(d) ORDER BY d.date), ''[]''::json) FROM (
       SELECT f.ship_date::text AS date, COALESCE(SUM(%s),0) AS revenue, 0 AS normal_total, 0 AS selling_total
       FROM %I f %s AND f.ship_date IS NOT NULL
       GROUP BY f.ship_date
     ) d',
    rev_f, tbl, where_clause
  ) INTO result;

  RETURN json_build_object('dailyTrend', result);
END $function$;
