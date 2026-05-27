-- fn_client_wine_analysis: 어드민 매출분석(fn_client_analysis) 와 동일한 매출/지원률 표현 통일
--
-- 문제: 세일즈 분석의 totalRevenue 와 avgDiscount 가 어드민 매출분석과 5%+ 차이.
-- 원인:
--   - 세일즈는 SUM(supply_amount) 만 사용 → 2025-08 이전 데이터에서 supply_amount 가 부풀려진 값 그대로 합산
--   - selling_price * quantity 곱셈도 이전 포맷(selling_price = 총액)에서 이중 곱하기로 왜곡
-- 수정:
--   - 매출 표현 통일: ship_date >= 2025-08-01 → supply_amount, 이전 → COALESCE(selling_price, supply_amount)
--   - 지원률 비교는 2025-08 이후만 (safe_normal / safe_selling)
--   - bigint cast-before-multiply (overflow 방지)

CREATE OR REPLACE FUNCTION public.fn_client_wine_analysis(
  p_type text,
  p_manager text DEFAULT ''::text,
  p_department text DEFAULT ''::text,
  p_client text DEFAULT ''::text,
  p_start text DEFAULT ''::text,
  p_end text DEFAULT ''::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  ship_tbl TEXT;
  inv_tbl TEXT;
  is_wine BOOL;
  where_clause TEXT := 'WHERE 1=1';
  prev_where TEXT := '';
  days_diff INT;
  prev_start TEXT;
  prev_end TEXT;
  result JSON;
  -- 통합 매출 표현
  rev_expr CONSTANT TEXT :=
    '(CASE WHEN ship_date::date >= ''2025-08-01''::date THEN supply_amount::bigint
           ELSE COALESCE(NULLIF(selling_price,0)::bigint, supply_amount::bigint, 0) END)';
  -- 정상가/판매가 비교는 2025-08 이후만 (이전은 selling_price 가 단가가 아님)
  safe_normal CONSTANT TEXT :=
    'CASE WHEN ship_date::date >= ''2025-08-01''::date
          THEN base_price::bigint * quantity::bigint ELSE 0 END';
  safe_selling CONSTANT TEXT :=
    'CASE WHEN ship_date::date >= ''2025-08-01''::date
          THEN selling_price::bigint * quantity::bigint ELSE 0 END';
BEGIN
  is_wine := (p_type <> 'glass');
  IF is_wine THEN ship_tbl := 'shipments'; inv_tbl := 'inventory_cdv';
  ELSE ship_tbl := 'glass_shipments'; inv_tbl := 'inventory_dl'; END IF;

  IF p_manager <> '' THEN where_clause := where_clause || format(' AND s.manager = %L', p_manager); END IF;
  IF p_department <> '' THEN where_clause := where_clause || format(' AND s.department = %L', p_department); END IF;
  IF p_client <> '' THEN where_clause := where_clause || format(' AND s.client_code = %L', p_client); END IF;
  IF p_start <> '' THEN where_clause := where_clause || format(' AND s.ship_date::date >= %L::date', p_start); END IF;
  IF p_end <> '' THEN where_clause := where_clause || format(' AND s.ship_date::date <= %L::date', p_end); END IF;

  IF p_start <> '' AND p_end <> '' THEN
    days_diff := (p_end::date - p_start::date);
    prev_end := (p_start::date - 1)::TEXT;
    prev_start := (p_start::date - 1 - days_diff)::TEXT;
    prev_where := replace(where_clause, format('s.ship_date::date >= %L::date', p_start), format('s.ship_date::date >= %L::date', prev_start));
    prev_where := replace(prev_where, format('s.ship_date::date <= %L::date', p_end), format('s.ship_date::date <= %L::date', prev_end));
  END IF;

  IF is_wine THEN
    EXECUTE format(
      'WITH filtered AS (
         SELECT s.item_no, s.item_name, s.quantity, s.selling_price, s.supply_amount,
                s.ship_date,
                COALESCE(w.country_en, '''') AS country,
                COALESCE(w.region, '''') AS region,
                COALESCE(w.grape_varieties, '''') AS grape_varieties,
                COALESCE(w.wine_type, '''') AS wine_type,
                COALESCE(w.supply_price, inv.supply_price, 0) AS base_price,
                COALESCE(w.available_stock, inv.available_stock, 0) AS remaining_stock
         FROM %I s
         LEFT JOIN wines w ON w.item_code = s.item_no
         LEFT JOIN %I inv ON inv.item_no = s.item_no
         %s
       ),
       summary AS (
         SELECT COALESCE(SUM(%s),0) AS "totalRevenue",
                COUNT(*) AS "totalShipments",
                CASE WHEN SUM(%s) > 0
                     THEN ROUND(((SUM(%s) - SUM(%s)) / NULLIF(SUM(%s),0)::numeric) * 1000) / 10.0
                ELSE 0 END AS "avgDiscount"
         FROM filtered
       ),
       by_country AS (
         SELECT CASE WHEN country = '''' THEN ''(미분류)'' ELSE country END AS name,
                COALESCE(SUM(%s),0) AS value
         FROM filtered GROUP BY 1 ORDER BY value DESC LIMIT 10
       ),
       by_region AS (
         SELECT CASE WHEN region = '''' THEN ''(미분류)'' ELSE region END AS name,
                COALESCE(SUM(%s),0) AS value
         FROM filtered WHERE region <> '''' GROUP BY 1 ORDER BY value DESC LIMIT 10
       ),
       by_type AS (
         SELECT CASE
           WHEN wine_type = '''' THEN ''(미분류)''
           WHEN lower(wine_type) IN (''red'',''레드'') THEN ''Red''
           WHEN lower(wine_type) IN (''white'',''화이트'') THEN ''White''
           WHEN lower(wine_type) IN (''sparkling'',''스파클링'') THEN ''Sparkling''
           WHEN lower(wine_type) IN (''rose'',''rosé'',''로제'') THEN ''Rose''
           WHEN lower(wine_type) IN (''dessert'',''디저트'',''fortified'') THEN ''Dessert''
           ELSE wine_type END AS name,
           COALESCE(SUM(%s),0) AS value
         FROM filtered GROUP BY 1 ORDER BY value DESC
       ),
       by_grape AS (
         SELECT trim(g) AS name, COALESCE(SUM(%s),0) AS value
         FROM filtered, unnest(string_to_array(grape_varieties, '','')) AS g
         WHERE grape_varieties <> ''''
         GROUP BY 1 ORDER BY value DESC LIMIT 10
       ),
       by_price AS (
         SELECT (FLOOR(base_price / 10000) * 10000)::BIGINT AS band,
                COALESCE(SUM(%s),0) AS value,
                COUNT(DISTINCT item_no) AS cnt
         FROM filtered WHERE base_price > 0
         GROUP BY 1 ORDER BY band
       ),
       item_agg AS (
         SELECT item_no AS code, MAX(item_name) AS name,
                COALESCE(SUM(%s),0) AS revenue,
                CASE WHEN SUM(%s) > 0
                     THEN ROUND(((SUM(%s) - SUM(%s)) / NULLIF(SUM(%s),0)::numeric) * 1000) / 10.0
                ELSE 0 END AS discount,
                COALESCE(SUM(quantity)::bigint,0) AS quantity,
                MAX(remaining_stock) AS stock
         FROM filtered GROUP BY item_no
       ),
       item_ranked AS (
         SELECT *, ROW_NUMBER() OVER (ORDER BY revenue DESC) AS rn
         FROM item_agg ORDER BY revenue DESC LIMIT 50
       )
       SELECT json_build_object(
         ''summary'', (SELECT row_to_json(s) FROM summary s),
         ''byCountry'', (SELECT COALESCE(json_agg(row_to_json(c)), ''[]''::json) FROM by_country c),
         ''byRegion'', (SELECT COALESCE(json_agg(row_to_json(r)), ''[]''::json) FROM by_region r),
         ''byType'', (SELECT COALESCE(json_agg(row_to_json(t)), ''[]''::json) FROM by_type t),
         ''byGrape'', (SELECT COALESCE(json_agg(row_to_json(g)), ''[]''::json) FROM by_grape g),
         ''byPrice'', (SELECT COALESCE(json_agg(row_to_json(p)), ''[]''::json) FROM by_price p),
         ''itemRanking'', (SELECT COALESCE(json_agg(row_to_json(i) ORDER BY i.rn), ''[]''::json) FROM item_ranked i)
       )',
      ship_tbl, inv_tbl, where_clause,
      rev_expr, safe_normal, safe_normal, safe_selling, safe_normal,
      rev_expr, rev_expr, rev_expr, rev_expr, rev_expr,
      rev_expr, safe_normal, safe_normal, safe_selling, safe_normal
    ) INTO result;

  ELSE
    EXECUTE format(
      'WITH filtered AS (
         SELECT s.item_no, s.item_name, s.quantity, s.selling_price, s.supply_amount,
                s.ship_date,
                COALESCE(inv.supply_price, gi.supply_price, 0) AS base_price,
                COALESCE(inv.available_stock, 0) AS remaining_stock
         FROM %I s
         LEFT JOIN glass_items gi ON gi.item_no = s.item_no
         LEFT JOIN %I inv ON inv.item_no = s.item_no
         %s
       ),
       summary AS (
         SELECT COALESCE(SUM(%s),0) AS "totalRevenue",
                COUNT(*) AS "totalShipments",
                CASE WHEN SUM(%s) > 0
                     THEN ROUND(((SUM(%s) - SUM(%s)) / NULLIF(SUM(%s),0)::numeric) * 1000) / 10.0
                ELSE 0 END AS "avgDiscount"
         FROM filtered
       ),
       by_price AS (
         SELECT (FLOOR(base_price / 10000) * 10000)::BIGINT AS band,
                COALESCE(SUM(%s),0) AS value,
                COUNT(DISTINCT item_no) AS cnt
         FROM filtered WHERE base_price > 0
         GROUP BY 1 ORDER BY band
       ),
       item_agg AS (
         SELECT item_no AS code, MAX(item_name) AS name,
                COALESCE(SUM(%s),0) AS revenue,
                CASE WHEN SUM(%s) > 0
                     THEN ROUND(((SUM(%s) - SUM(%s)) / NULLIF(SUM(%s),0)::numeric) * 1000) / 10.0
                ELSE 0 END AS discount,
                COALESCE(SUM(quantity)::bigint,0) AS quantity,
                MAX(remaining_stock) AS stock
         FROM filtered GROUP BY item_no
       ),
       item_ranked AS (
         SELECT *, ROW_NUMBER() OVER (ORDER BY revenue DESC) AS rn
         FROM item_agg ORDER BY revenue DESC LIMIT 50
       )
       SELECT json_build_object(
         ''summary'', (SELECT row_to_json(s) FROM summary s),
         ''byCountry'', ''[]''::json,
         ''byRegion'', ''[]''::json,
         ''byType'', ''[]''::json,
         ''byGrape'', ''[]''::json,
         ''byPrice'', (SELECT COALESCE(json_agg(row_to_json(p)), ''[]''::json) FROM by_price p),
         ''itemRanking'', (SELECT COALESCE(json_agg(row_to_json(i) ORDER BY i.rn), ''[]''::json) FROM item_ranked i)
       )',
      ship_tbl, inv_tbl, where_clause,
      rev_expr, safe_normal, safe_normal, safe_selling, safe_normal,
      rev_expr,
      rev_expr, safe_normal, safe_normal, safe_selling, safe_normal
    ) INTO result;
  END IF;

  -- 이전 동기간 (prevRevenue, prevAvgDiscount, prevRanking)
  IF prev_where <> '' THEN
    DECLARE
      prev_rev NUMERIC;
      prev_disc NUMERIC;
      prev_ranks JSON;
    BEGIN
      IF is_wine THEN
        EXECUTE format(
          'WITH pf AS (
             SELECT s.quantity, s.selling_price, s.supply_amount, s.ship_date, s.item_no,
                    COALESCE(w.supply_price, inv.supply_price, 0) AS base_price
             FROM %I s
             LEFT JOIN wines w ON w.item_code = s.item_no
             LEFT JOIN %I inv ON inv.item_no = s.item_no
             %s
           )
           SELECT COALESCE(SUM(%s),0)::numeric,
                  CASE WHEN SUM(%s) > 0
                       THEN ROUND(((SUM(%s) - SUM(%s)) / NULLIF(SUM(%s),0)::numeric) * 1000) / 10.0
                  ELSE 0 END
           FROM pf',
          ship_tbl, inv_tbl, prev_where,
          rev_expr, safe_normal, safe_normal, safe_selling, safe_normal
        ) INTO prev_rev, prev_disc;
      ELSE
        EXECUTE format(
          'WITH pf AS (
             SELECT s.quantity, s.selling_price, s.supply_amount, s.ship_date, s.item_no,
                    COALESCE(inv.supply_price, gi.supply_price, 0) AS base_price
             FROM %I s
             LEFT JOIN glass_items gi ON gi.item_no = s.item_no
             LEFT JOIN %I inv ON inv.item_no = s.item_no
             %s
           )
           SELECT COALESCE(SUM(%s),0)::numeric,
                  CASE WHEN SUM(%s) > 0
                       THEN ROUND(((SUM(%s) - SUM(%s)) / NULLIF(SUM(%s),0)::numeric) * 1000) / 10.0
                  ELSE 0 END
           FROM pf',
          ship_tbl, inv_tbl, prev_where,
          rev_expr, safe_normal, safe_normal, safe_selling, safe_normal
        ) INTO prev_rev, prev_disc;
      END IF;

      EXECUTE format(
        'SELECT COALESCE(json_object_agg(item_no, rn), ''{}''::json)
         FROM (
           SELECT s.item_no, ROW_NUMBER() OVER (ORDER BY SUM(%s) DESC) AS rn
           FROM %I s
           %s
           GROUP BY s.item_no
         ) sub',
        replace(rev_expr, 'ship_date', 's.ship_date'),
        ship_tbl, prev_where
      ) INTO prev_ranks;

      result := (result::jsonb
        || jsonb_build_object('prevRevenue', prev_rev)
        || jsonb_build_object('prevAvgDiscount', prev_disc)
        || jsonb_build_object('prevRanking', prev_ranks)
      )::json;
    END;
  END IF;

  RETURN result;
END;
$function$;
