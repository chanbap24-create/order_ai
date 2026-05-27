-- fn_client_detail / fn_manager_brands: 2025-08 분기 매출 표현 통일
--
-- 기존엔 두 함수가 supply_amount 만 SUM 하여,
-- 2025-08 이전 shipments(supply_amount 부풀림 상태) 에서 매출이 왜곡되었음.
-- fn_client_analysis 와 동일한 매출 표현으로 통일:
--   - ship_date >= 2025-08-01 : supply_amount::bigint
--   - ship_date <  2025-08-01 : COALESCE(NULLIF(selling_price,0)::bigint, supply_amount::bigint, 0)
-- 곱셈은 bigint cast-before-multiply 로 overflow 방지.

CREATE OR REPLACE FUNCTION public.fn_client_detail(
  p_type text,
  p_client_code text,
  p_start_date text DEFAULT ''::text,
  p_end_date text DEFAULT ''::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  tbl TEXT;
  inv_tbl TEXT;
  where_clause TEXT;
  result JSON;
  rev_expr CONSTANT TEXT :=
    '(CASE WHEN s.ship_date::date >= ''2025-08-01''::date
           THEN s.supply_amount::bigint
           ELSE COALESCE(NULLIF(s.selling_price,0)::bigint, s.supply_amount::bigint, 0) END)';
  -- 정상가/판매가 비교는 2025-08 이후만 (이전 selling_price 신뢰도 낮음)
  safe_selling CONSTANT TEXT :=
    'CASE WHEN s.ship_date::date >= ''2025-08-01''::date AND s.selling_price > 0
          THEN s.selling_price::bigint * s.quantity::bigint ELSE 0 END';
BEGIN
  IF p_type = 'glass' THEN tbl := 'glass_shipments'; inv_tbl := 'inventory_dl';
  ELSE tbl := 'shipments'; inv_tbl := 'inventory_cdv'; END IF;

  where_clause := format('WHERE client_code = %L', p_client_code);
  IF p_start_date <> '' THEN where_clause := where_clause || format(' AND ship_date::date >= %L::date', p_start_date); END IF;
  IF p_end_date <> '' THEN where_clause := where_clause || format(' AND ship_date::date <= %L::date', p_end_date); END IF;

  EXECUTE format(
    'SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.revenue DESC), ''[]''::json)
     FROM (
       SELECT s.item_no, s.item_name,
              COALESCE(SUM(s.quantity)::bigint,0) AS quantity,
              COALESCE(SUM(%s),0) AS revenue,
              COUNT(*) AS count,
              i.supply_price AS "supplyPrice",
              CASE WHEN SUM(s.quantity) > 0 AND SUM(%s) > 0
                THEN ROUND(SUM(%s) / NULLIF(SUM(s.quantity),0))
                ELSE NULL END AS "avgSellingPrice",
              CASE WHEN i.supply_price > 0 AND SUM(s.quantity) > 0
                   AND SUM(%s) > 0
                THEN ROUND(((i.supply_price::bigint * SUM(s.quantity)::bigint
                   - SUM(%s))
                   / NULLIF(i.supply_price::bigint * SUM(s.quantity)::bigint,0)) * 1000) / 10.0
                ELSE NULL END AS "discountRate"
       FROM %I s LEFT JOIN %I i ON s.item_no = i.item_no
       %s
       GROUP BY s.item_no, s.item_name, i.supply_price
     ) sub',
    rev_expr, safe_selling, safe_selling, safe_selling, safe_selling,
    tbl, inv_tbl, where_clause
  ) INTO result;

  RETURN json_build_object('clientItems', result);
END;
$function$;


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
  IF p_department <> '' THEN
    IF p_department = '(미분류)' THEN
      where_clause := where_clause || ' AND (department IS NULL OR department = '''')';
    ELSE
      where_clause := where_clause || format(' AND department = %L', p_department);
    END IF;
  END IF;
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
         (CASE WHEN ship_date::date >= ''2025-08-01''::date
               THEN supply_amount::bigint
               ELSE COALESCE(NULLIF(selling_price,0)::bigint, supply_amount::bigint, 0) END) AS rev
       FROM %I
       %s
     ),
     brand_rev AS (
       SELECT mgr, brand, SUM(rev) AS rev
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
