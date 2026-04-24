-- fn_manager_brands 최적화
--
-- 기존 구현은 `FROM (SELECT DISTINCT manager ...) managers` 후 각 매니저마다
-- brands 와 bizClients 를 **correlated subquery** 로 계산해서 shipments
-- 전체를 "매니저 수 × 2" 회 반복 스캔했다. 190k 행 + 매니저 10명 기준
-- ~1.1초 소요 (shared hit 112k buffers).
--
-- 이 버전은 base CTE 로 한 번만 스캔 후 GROUP BY / 윈도우 함수로 일괄 집계.
-- 예상: ~100~200ms (5~10배 단축).

CREATE OR REPLACE FUNCTION public.fn_manager_brands(
  p_type text,
  p_manager text DEFAULT ''::text,
  p_department text DEFAULT ''::text,
  p_business_type text DEFAULT ''::text,
  p_start_date text DEFAULT ''::text,
  p_end_date text DEFAULT ''::text,
  p_client_search text DEFAULT ''::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  tbl TEXT;
  where_clause TEXT := 'WHERE 1=1';
  result JSON;
BEGIN
  IF p_type = 'glass' THEN tbl := 'glass_shipments'; ELSE tbl := 'shipments'; END IF;

  IF p_manager <> '' THEN where_clause := where_clause || format(' AND manager = %L', p_manager); END IF;
  IF p_department <> '' THEN where_clause := where_clause || format(' AND department = %L', p_department); END IF;
  IF p_business_type <> '' THEN where_clause := where_clause || format(' AND business_type = %L', p_business_type); END IF;
  IF p_start_date <> '' THEN where_clause := where_clause || format(' AND ship_date::date >= %L::date', p_start_date); END IF;
  IF p_end_date <> '' THEN where_clause := where_clause || format(' AND ship_date::date <= %L::date', p_end_date); END IF;
  IF p_client_search <> '' THEN where_clause := where_clause || format(' AND client_name ILIKE %L', '%%' || p_client_search || '%%'); END IF;

  EXECUTE format(
    'WITH base AS (
       SELECT
         COALESCE(NULLIF(manager, ''''), ''(미지정)'') AS mgr,
         CASE
           WHEN %L = ''glass'' AND upper(split_part(item_name, '' '', 1)) = ''RD''
             THEN (regexp_match(split_part(item_name, '' '', 2), ''(\d{3,5})''))[1]
           WHEN %L <> ''glass'' AND split_part(item_name, '' '', 1) ~ ''^[A-Za-z]{2,4}$''
             THEN upper(split_part(item_name, '' '', 1))
           ELSE NULL
         END AS brand,
         CASE
           WHEN business_type IS NULL OR business_type = '''' THEN ''(미분류)''
           WHEN position(''/'' in business_type) > 0 THEN substring(business_type from position(''/'' in business_type)+1)
           ELSE business_type
         END AS biz,
         client_code,
         supply_amount
       FROM %I
       %s
     ),
     brand_rev AS (
       SELECT mgr, brand, SUM(supply_amount) AS rev
       FROM base
       WHERE brand IS NOT NULL
       GROUP BY mgr, brand
     ),
     brand_ranked AS (
       SELECT mgr, brand, rev,
              ROW_NUMBER() OVER (PARTITION BY mgr ORDER BY rev DESC) AS rn
       FROM brand_rev
     ),
     brand_top AS (
       SELECT mgr,
              json_agg(json_build_object(''brand'', brand, ''revenue'', rev) ORDER BY rev DESC) AS brands
       FROM brand_ranked
       WHERE rn <= 10
       GROUP BY mgr
     ),
     biz_agg AS (
       SELECT mgr, biz, COUNT(DISTINCT client_code) AS cnt
       FROM base
       GROUP BY mgr, biz
     ),
     biz_json AS (
       SELECT mgr,
              json_agg(json_build_object(''biz'', biz, ''count'', cnt) ORDER BY cnt DESC) AS biz_clients
       FROM biz_agg
       GROUP BY mgr
     ),
     all_mgr AS (SELECT DISTINCT mgr FROM base)
     SELECT COALESCE(
       json_object_agg(m.mgr, json_build_object(
         ''brands'', COALESCE(bt.brands, ''[]''::json),
         ''bizClients'', COALESCE(bj.biz_clients, ''[]''::json)
       )),
       ''{}''::json
     )
     FROM all_mgr m
     LEFT JOIN brand_top bt USING (mgr)
     LEFT JOIN biz_json bj USING (mgr)',
    p_type, p_type, tbl, where_clause
  ) INTO result;

  RETURN result;
END;
$function$;
