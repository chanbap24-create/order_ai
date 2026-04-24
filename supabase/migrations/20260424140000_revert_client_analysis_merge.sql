-- 20260424130000_merge_manager_brands_into_client_analysis.sql 에서
-- fn_client_analysis 에 managerBrands 통합을 시도했는데, MATERIALIZED
-- CTE 가 temp file 로 spill 되면서 glass 가 오히려 더 느려짐
-- (267ms → 357ms). 원복하고 fn_manager_brands 최적화(correlated subquery
-- 제거) 는 그대로 유지.

CREATE OR REPLACE FUNCTION public.fn_client_analysis(
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
  inv_tbl TEXT;
  where_clause TEXT := 'WHERE 1=1';
  prev_where TEXT := '';
  days_diff INT;
  prev_start TEXT;
  prev_end TEXT;
  result JSON;
BEGIN
  IF p_type = 'glass' THEN tbl := 'glass_shipments'; inv_tbl := 'inventory_dl';
  ELSE tbl := 'shipments'; inv_tbl := 'inventory_cdv'; END IF;

  IF p_manager <> '' THEN where_clause := where_clause || format(' AND manager = %L', p_manager); END IF;
  IF p_department <> '' THEN where_clause := where_clause || format(' AND department = %L', p_department); END IF;
  IF p_business_type <> '' THEN where_clause := where_clause || format(' AND business_type = %L', p_business_type); END IF;
  IF p_start_date <> '' THEN where_clause := where_clause || format(' AND ship_date::date >= %L::date', p_start_date); END IF;
  IF p_end_date <> '' THEN where_clause := where_clause || format(' AND ship_date::date <= %L::date', p_end_date); END IF;
  IF p_client_search <> '' THEN where_clause := where_clause || format(' AND client_name ILIKE %L', '%%' || p_client_search || '%%'); END IF;

  IF p_start_date <> '' AND p_end_date <> '' THEN
    days_diff := (p_end_date::date - p_start_date::date);
    prev_end := (p_start_date::date - 1)::TEXT;
    prev_start := (p_start_date::date - 1 - days_diff)::TEXT;
    prev_where := where_clause;
    prev_where := replace(prev_where, format('ship_date::date >= %L::date', p_start_date), format('ship_date::date >= %L::date', prev_start));
    prev_where := replace(prev_where, format('ship_date::date <= %L::date', p_end_date), format('ship_date::date <= %L::date', prev_end));
  END IF;

  EXECUTE format(
    'WITH filtered AS (SELECT * FROM %I %s),
     summary AS (
       SELECT COALESCE(SUM(supply_amount),0) AS total_revenue,
              COALESCE(SUM(quantity),0) AS total_quantity,
              COUNT(*) AS total_count,
              COUNT(DISTINCT client_code) AS distinct_clients,
              COALESCE(SUM(CASE WHEN quantity < 0 THEN ABS(supply_amount) ELSE 0 END), 0) AS return_amount,
              COALESCE(SUM(CASE WHEN quantity > 0 THEN supply_amount ELSE 0 END), 0) AS positive_revenue
       FROM filtered
     ),
     top10_calc AS (
       SELECT CASE WHEN SUM(rev) > 0
         THEN ROUND((SUM(CASE WHEN rn <= GREATEST(CEIL(total_cnt * 0.1), 1) THEN rev ELSE 0 END) / NULLIF(SUM(rev),0) * 100)::numeric, 1)
         ELSE 0 END AS top10_pct
       FROM (
         SELECT SUM(supply_amount) as rev,
                ROW_NUMBER() OVER (ORDER BY SUM(supply_amount) DESC) as rn,
                COUNT(*) OVER () as total_cnt
         FROM filtered WHERE supply_amount > 0 GROUP BY client_code
       ) ranked
     ),
     loyalty_calc AS (
       SELECT CASE WHEN COUNT(*) > 0
         THEN ROUND((COUNT(*) FILTER (WHERE order_months >= 2)::numeric / NULLIF(COUNT(*),0) * 100)::numeric, 1)
         ELSE 0 END AS repeat_rate
       FROM (
         SELECT client_code, COUNT(DISTINCT substring(ship_date::text from 1 for 7)) as order_months
         FROM filtered WHERE supply_amount > 0 GROUP BY client_code
       ) cl
     ),
     client_agg AS (
       SELECT client_code, client_name,
              COALESCE(SUM(supply_amount),0) AS revenue,
              COALESCE(SUM(quantity),0) AS quantity,
              COUNT(DISTINCT item_no) AS item_count
       FROM filtered GROUP BY client_code, client_name
     ),
     client_ranked AS (
       SELECT *, ROW_NUMBER() OVER (ORDER BY revenue DESC) AS rn
       FROM client_agg ORDER BY revenue DESC LIMIT 30
     ),
     daily AS (
       SELECT f.ship_date::TEXT AS date, COALESCE(SUM(f.supply_amount),0) AS revenue,
              COALESCE(SUM(CASE WHEN i.supply_price > 0 AND f.selling_price > 0 AND f.quantity > 0
                THEN i.supply_price * f.quantity ELSE 0 END),0) AS normal_total,
              COALESCE(SUM(CASE WHEN i.supply_price > 0 AND f.selling_price > 0 AND f.quantity > 0
                THEN f.selling_price * f.quantity ELSE 0 END),0) AS selling_total
       FROM filtered f LEFT JOIN %I i ON f.item_no = i.item_no
       WHERE f.ship_date IS NOT NULL
       GROUP BY f.ship_date ORDER BY f.ship_date
     ),
     biz AS (
       SELECT CASE WHEN business_type IS NULL OR business_type = '''' THEN ''(미분류)''
              WHEN position(''/'' in business_type) > 0 THEN substring(business_type from position(''/'' in business_type)+1)
              ELSE business_type END AS name,
              COALESCE(SUM(supply_amount),0) AS revenue
       FROM filtered GROUP BY 1 ORDER BY revenue DESC
     ),
     brand_agg AS (
       SELECT CASE
         WHEN %L = ''glass'' AND upper(split_part(item_name, '' '', 1)) = ''RD''
           THEN (regexp_match(split_part(item_name, '' '', 2), ''(\d{3,5})''))[1]
         WHEN %L <> ''glass'' AND split_part(item_name, '' '', 1) ~ ''^[A-Za-z]{2,4}$''
           THEN upper(split_part(item_name, '' '', 1))
         ELSE NULL END AS name,
         COALESCE(SUM(supply_amount),0) AS revenue
       FROM filtered WHERE item_name IS NOT NULL GROUP BY 1
       HAVING CASE
         WHEN %L = ''glass'' AND upper(split_part(item_name, '' '', 1)) = ''RD''
           THEN (regexp_match(split_part(item_name, '' '', 2), ''(\d{3,5})''))[1]
         WHEN %L <> ''glass'' AND split_part(item_name, '' '', 1) ~ ''^[A-Za-z]{2,4}$''
           THEN upper(split_part(item_name, '' '', 1))
         ELSE NULL END IS NOT NULL
       ORDER BY revenue DESC LIMIT 15
     ),
     mgr_agg AS (
       SELECT COALESCE(NULLIF(f.manager,''''), ''(미지정)'') AS manager,
              COUNT(DISTINCT f.client_code) AS client_count,
              COALESCE(SUM(f.supply_amount),0) AS revenue,
              CASE WHEN SUM(CASE WHEN i.supply_price > 0 AND f.selling_price > 0 AND f.quantity > 0
                   THEN i.supply_price * f.quantity ELSE 0 END) > 0
                THEN ROUND(((SUM(CASE WHEN i.supply_price > 0 AND f.selling_price > 0 AND f.quantity > 0
                   THEN i.supply_price * f.quantity ELSE 0 END)
                   - SUM(CASE WHEN i.supply_price > 0 AND f.selling_price > 0 AND f.quantity > 0
                   THEN f.selling_price * f.quantity ELSE 0 END))
                   / NULLIF(SUM(CASE WHEN i.supply_price > 0 AND f.selling_price > 0 AND f.quantity > 0
                   THEN i.supply_price * f.quantity ELSE 0 END),0)) * 1000) / 10.0
              ELSE NULL END AS discount_rate
       FROM filtered f LEFT JOIN %I i ON f.item_no = i.item_no
       GROUP BY 1 ORDER BY revenue DESC
     ),
     country_agg AS (
       SELECT COALESCE(NULLIF(i.country,''''), ''(미분류)'') AS name,
              COALESCE(SUM(f.supply_amount),0) AS revenue
       FROM filtered f LEFT JOIN %I i ON f.item_no = i.item_no
       GROUP BY 1 ORDER BY revenue DESC LIMIT 15
     ),
     client_discount AS (
       SELECT f.client_code,
              SUM(CASE WHEN i.supply_price > 0 AND f.selling_price > 0 AND f.quantity > 0
                  THEN i.supply_price * f.quantity ELSE 0 END) AS normal_total,
              SUM(CASE WHEN i.supply_price > 0 AND f.selling_price > 0 AND f.quantity > 0
                  THEN f.selling_price * f.quantity ELSE 0 END) AS selling_total
       FROM filtered f LEFT JOIN %I i ON f.item_no = i.item_no
       GROUP BY f.client_code
     )
     SELECT json_build_object(
       ''summary'', (SELECT row_to_json(r) FROM (SELECT s.*, t.top10_pct, l.repeat_rate FROM summary s, top10_calc t, loyalty_calc l) r),
       ''clientRanking'', (SELECT COALESCE(json_agg(row_to_json(c) ORDER BY c.rn), ''[]''::json) FROM (
         SELECT cr.client_code AS code, cr.client_name AS name, cr.revenue, cr.quantity,
                cr.item_count AS "itemCount", cr.rn,
                cd.normal_total, cd.selling_total
         FROM client_ranked cr LEFT JOIN client_discount cd ON cr.client_code = cd.client_code
       ) c),
       ''dailyTrend'', (SELECT COALESCE(json_agg(row_to_json(d)), ''[]''::json) FROM daily d),
       ''businessAnalysis'', (SELECT COALESCE(json_agg(row_to_json(b)), ''[]''::json) FROM biz b),
       ''brandAnalysis'', (SELECT COALESCE(json_agg(row_to_json(ba)), ''[]''::json) FROM brand_agg ba),
       ''managerAnalysis'', (SELECT COALESCE(json_agg(row_to_json(m)), ''[]''::json) FROM mgr_agg m),
       ''countryAnalysis'', (SELECT COALESCE(json_agg(row_to_json(ca)), ''[]''::json) FROM country_agg ca)
     )',
    tbl, where_clause,
    inv_tbl,
    p_type, p_type, p_type, p_type,
    inv_tbl, inv_tbl, inv_tbl
  ) INTO result;

  IF prev_where <> '' THEN
    DECLARE
      prev_ranking JSON;
    BEGIN
      EXECUTE format(
        'SELECT COALESCE(json_object_agg(client_code, rn), ''{}''::json)
         FROM (
           SELECT client_code, ROW_NUMBER() OVER (ORDER BY SUM(supply_amount) DESC) AS rn
           FROM %I %s
           GROUP BY client_code
         ) sub',
        tbl, prev_where
      ) INTO prev_ranking;
      result := result::jsonb || jsonb_build_object('prevRanking', prev_ranking);
      result := result::json;
    END;
  END IF;

  RETURN result;
END;
$function$;
