-- fn_client_analysis: 글라스(대유라이프) 지원률 오류 수정
--
-- 문제:
--   20260527140000 패치에서 정상가(normal) 산정에 wines 테이블을 우선 적용하면서
--   'glass 는 wines 와 매칭되지 않는다'는 전제로 LEFT JOIN wines + COALESCE(w.supply_price, i.supply_price)
--   를 모든 타입에 공통 적용했다. 그러나 글라스 품번(glass_shipments.item_no)이
--   wines.item_code 와 거의 100% 충돌하여, 글라스 정상가가 inventory_dl.supply_price 대신
--   엉뚱한 와인 supply_price 로 대체되었다. 그 결과 정상가합이 붕괴되어
--   지원률이 -89775% 같은 비정상 값으로 표시됨.
--
-- 수정:
--   정상가 표현(safe_normal)과 그 조건(np_norm_cond)을 타입별로 분기한다.
--   - glass(대유라이프): inventory_dl.supply_price 만 사용 (wines 무시)
--   - wine(까브드뱅):   COALESCE(wines.supply_price, inventory_cdv.supply_price) 기존 유지
--   LEFT JOIN wines 자체는 포맷 문자열에 그대로 두지만, glass 표현식이 w 를 참조하지 않으므로
--   결과에 영향이 없다(wines.item_code 는 사실상 유일하여 행 증식도 없음).

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
  rev_f CONSTANT TEXT :=
    '(CASE WHEN f.ship_date::date >= ''2025-08-01''::date THEN f.supply_amount::bigint
           ELSE COALESCE(NULLIF(f.selling_price,0)::bigint, f.supply_amount::bigint, 0) END)';
  rev_n CONSTANT TEXT :=
    '(CASE WHEN ship_date::date >= ''2025-08-01''::date THEN supply_amount::bigint
           ELSE COALESCE(NULLIF(selling_price,0)::bigint, supply_amount::bigint, 0) END)';
  safe_selling CONSTANT TEXT :=
    'CASE WHEN f.ship_date::date >= ''2025-08-01''::date
          THEN f.selling_price::bigint * f.quantity ELSE 0 END';
  -- 정상가 표현/조건은 타입별로 분기 (BEGIN 블록에서 설정)
  safe_normal TEXT;
  np_norm_cond TEXT;
BEGIN
  IF p_type = 'glass' THEN
    tbl := 'glass_shipments'; inv_tbl := 'inventory_dl';
    -- 글라스: 정상가는 inventory_dl.supply_price 만 사용 (wines 조인은 글라스 품번과 충돌하므로 배제)
    safe_normal :=
      'CASE WHEN f.ship_date::date >= ''2025-08-01''::date
            THEN i.supply_price::bigint * f.quantity ELSE 0 END';
    np_norm_cond := 'i.supply_price > 0 AND f.selling_price > 0 AND f.quantity > 0';
  ELSE
    tbl := 'shipments'; inv_tbl := 'inventory_cdv';
    -- 와인: wines.supply_price 우선, inventory_cdv fallback
    safe_normal :=
      'CASE WHEN f.ship_date::date >= ''2025-08-01''::date
            THEN COALESCE(w.supply_price, i.supply_price)::bigint * f.quantity ELSE 0 END';
    np_norm_cond := 'COALESCE(w.supply_price, i.supply_price) > 0 AND f.selling_price > 0 AND f.quantity > 0';
  END IF;

  IF p_manager <> '' THEN where_clause := where_clause || format(' AND manager = %L', p_manager); END IF;
  IF p_department <> '' THEN
    IF p_department = '(미분류)' THEN
      where_clause := where_clause || ' AND (department IS NULL OR department = '''')';
    ELSE
      where_clause := where_clause || format(' AND department = %L', p_department);
    END IF;
  END IF;
  IF p_business_type <> '' THEN where_clause := where_clause || format(' AND business_type = %L', p_business_type); END IF;
  IF p_start_date <> '' THEN where_clause := where_clause || format(' AND ship_date >= %L', p_start_date); END IF;
  IF p_end_date <> '' THEN where_clause := where_clause || format(' AND ship_date <= %L', p_end_date); END IF;
  IF p_client_search <> '' THEN where_clause := where_clause || format(' AND client_name ILIKE %L', '%%' || p_client_search || '%%'); END IF;

  IF p_start_date <> '' AND p_end_date <> '' THEN
    days_diff := (p_end_date::date - p_start_date::date);
    prev_end := (p_start_date::date - 1)::TEXT;
    prev_start := (p_start_date::date - 1 - days_diff)::TEXT;
    prev_where := where_clause;
    prev_where := replace(prev_where, format('ship_date >= %L', p_start_date), format('ship_date >= %L', prev_start));
    prev_where := replace(prev_where, format('ship_date <= %L', p_end_date), format('ship_date <= %L', prev_end));
  END IF;

  EXECUTE format(
    'WITH filtered AS (SELECT * FROM %I %s),
     summary AS (
       SELECT COALESCE(SUM(%s),0) AS total_revenue,
              COALESCE(SUM(f.quantity)::bigint,0) AS total_quantity,
              COUNT(*) AS total_count,
              COUNT(DISTINCT f.client_code) AS distinct_clients,
              COALESCE(SUM(CASE WHEN f.quantity < 0 THEN ABS(%s) ELSE 0 END), 0) AS return_amount,
              COALESCE(SUM(CASE WHEN f.quantity > 0 THEN %s ELSE 0 END), 0) AS positive_revenue
       FROM filtered f
     ),
     discount_calc AS (
       SELECT
         COALESCE(SUM(CASE WHEN %s THEN (%s) ELSE 0 END), 0) AS normal_total,
         COALESCE(SUM(CASE WHEN %s THEN (%s) ELSE 0 END), 0) AS selling_total
       FROM filtered f
       LEFT JOIN %I i ON f.item_no = i.item_no
       LEFT JOIN wines w ON w.item_code = f.item_no
     ),
     top10_calc AS (
       SELECT CASE WHEN SUM(rev) > 0
         THEN ROUND((SUM(CASE WHEN rn <= GREATEST(CEIL(total_cnt * 0.1), 1) THEN rev ELSE 0 END) / NULLIF(SUM(rev),0) * 100)::numeric, 1)
         ELSE 0 END AS top10_pct
       FROM (
         SELECT SUM(%s) as rev,
                ROW_NUMBER() OVER (ORDER BY SUM(%s) DESC) as rn,
                COUNT(*) OVER () as total_cnt
         FROM filtered f WHERE f.supply_amount > 0 GROUP BY f.client_code
       ) ranked
     ),
     loyalty_calc AS (
       SELECT CASE WHEN COUNT(*) > 0
         THEN ROUND((COUNT(*) FILTER (WHERE order_months >= 2)::numeric / NULLIF(COUNT(*),0) * 100)::numeric, 1)
         ELSE 0 END AS repeat_rate
       FROM (
         SELECT f.client_code, COUNT(DISTINCT substring(f.ship_date::text from 1 for 7)) as order_months
         FROM filtered f WHERE f.supply_amount > 0 GROUP BY f.client_code
       ) cl
     ),
     client_agg AS (
       SELECT f.client_code, max(f.client_name) AS client_name,
              COALESCE(SUM(%s),0) AS revenue,
              COALESCE(SUM(f.quantity)::bigint,0) AS quantity,
              COUNT(DISTINCT f.item_no) AS item_count
       FROM filtered f GROUP BY f.client_code
     ),
     client_ranked AS (
       SELECT *, ROW_NUMBER() OVER (ORDER BY revenue DESC) AS rn
       FROM client_agg ORDER BY revenue DESC LIMIT 30
     ),
     daily AS (
       SELECT f.ship_date::TEXT AS date, COALESCE(SUM(%s),0) AS revenue,
              COALESCE(SUM(CASE WHEN %s THEN (%s) ELSE 0 END),0) AS normal_total,
              COALESCE(SUM(CASE WHEN %s THEN (%s) ELSE 0 END),0) AS selling_total
       FROM filtered f
       LEFT JOIN %I i ON f.item_no = i.item_no
       LEFT JOIN wines w ON w.item_code = f.item_no
       WHERE f.ship_date IS NOT NULL
       GROUP BY f.ship_date ORDER BY f.ship_date
     ),
     biz AS (
       SELECT CASE WHEN f.business_type IS NULL OR f.business_type = '''' THEN ''(미분류)''
              WHEN position(''/'' in f.business_type) > 0 THEN substring(f.business_type from position(''/'' in f.business_type)+1)
              ELSE f.business_type END AS name,
              COALESCE(SUM(%s),0) AS revenue
       FROM filtered f GROUP BY 1 ORDER BY revenue DESC
     ),
     brand_agg AS (
       SELECT CASE
         WHEN %L = ''glass'' AND upper(split_part(f.item_name, '' '', 1)) = ''RD''
           THEN (regexp_match(split_part(f.item_name, '' '', 2), ''(\d{3,5})''))[1]
         WHEN %L <> ''glass'' AND split_part(f.item_name, '' '', 1) ~ ''^[A-Za-z]{2,4}$''
           THEN upper(split_part(f.item_name, '' '', 1))
         ELSE NULL END AS name,
         COALESCE(SUM(%s),0) AS revenue
       FROM filtered f WHERE f.item_name IS NOT NULL GROUP BY 1
       HAVING CASE
         WHEN %L = ''glass'' AND upper(split_part(MAX(f.item_name), '' '', 1)) = ''RD''
           THEN (regexp_match(split_part(MAX(f.item_name), '' '', 2), ''(\d{3,5})''))[1]
         WHEN %L <> ''glass'' AND split_part(MAX(f.item_name), '' '', 1) ~ ''^[A-Za-z]{2,4}$''
           THEN upper(split_part(MAX(f.item_name), '' '', 1))
         ELSE NULL END IS NOT NULL
       ORDER BY revenue DESC LIMIT 15
     ),
     mgr_agg AS (
       SELECT COALESCE(NULLIF(f.manager,''''), ''(미지정)'') AS manager,
              COUNT(DISTINCT f.client_code) AS client_count,
              COALESCE(SUM(%s),0) AS revenue,
              CASE WHEN SUM(CASE WHEN %s THEN (%s) ELSE 0 END) > 0
                THEN ROUND(((SUM(CASE WHEN %s THEN (%s) ELSE 0 END)
                   - SUM(CASE WHEN %s THEN (%s) ELSE 0 END))
                   / NULLIF(SUM(CASE WHEN %s THEN (%s) ELSE 0 END),0)) * 1000) / 10.0
              ELSE NULL END AS discount_rate
       FROM filtered f
       LEFT JOIN %I i ON f.item_no = i.item_no
       LEFT JOIN wines w ON w.item_code = f.item_no
       GROUP BY 1 ORDER BY revenue DESC
     ),
     country_agg AS (
       SELECT COALESCE(NULLIF(i.country,''''), ''(미분류)'') AS name,
              COALESCE(SUM(%s),0) AS revenue
       FROM filtered f LEFT JOIN %I i ON f.item_no = i.item_no
       GROUP BY 1 ORDER BY revenue DESC LIMIT 15
     ),
     client_discount AS (
       SELECT f.client_code,
              SUM(CASE WHEN %s THEN (%s) ELSE 0 END) AS normal_total,
              SUM(CASE WHEN %s THEN (%s) ELSE 0 END) AS selling_total
       FROM filtered f
       LEFT JOIN %I i ON f.item_no = i.item_no
       LEFT JOIN wines w ON w.item_code = f.item_no
       GROUP BY f.client_code
     )
     SELECT json_build_object(
       ''summary'', (SELECT row_to_json(r) FROM (
         SELECT s.*, t.top10_pct, l.repeat_rate,
                CASE WHEN dc.normal_total > 0
                  THEN ROUND(((dc.normal_total - dc.selling_total) / NULLIF(dc.normal_total,0)::numeric) * 1000) / 10.0
                  ELSE 0 END AS avg_discount
         FROM summary s, top10_calc t, loyalty_calc l, discount_calc dc
       ) r),
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
    rev_f, rev_f, rev_f,
    np_norm_cond, safe_normal, np_norm_cond, safe_selling, inv_tbl,
    rev_f, rev_f,
    rev_f,
    rev_f, np_norm_cond, safe_normal, np_norm_cond, safe_selling, inv_tbl,
    rev_f,
    p_type, p_type, rev_f, p_type, p_type,
    rev_f, np_norm_cond, safe_normal, np_norm_cond, safe_normal, np_norm_cond, safe_selling, np_norm_cond, safe_normal, inv_tbl,
    rev_f, inv_tbl,
    np_norm_cond, safe_normal, np_norm_cond, safe_selling, inv_tbl
  ) INTO result;

  IF prev_where <> '' THEN
    DECLARE
      prev_ranking JSON;
    BEGIN
      EXECUTE format(
        'SELECT COALESCE(json_object_agg(client_code, rn) FILTER (WHERE client_code IS NOT NULL AND client_code <> ''''), ''{}''::json)
         FROM (
           SELECT client_code, ROW_NUMBER() OVER (ORDER BY SUM(%s) DESC) AS rn
           FROM %I %s
           GROUP BY client_code
         ) sub',
        rev_n, tbl, prev_where
      ) INTO prev_ranking;
      result := result::jsonb || jsonb_build_object('prevRanking', prev_ranking);
      result := result::json;
    END;
  END IF;

  RETURN result;
END;
$function$;
