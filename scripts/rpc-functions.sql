-- ── fn_shipment_filters ──
CREATE OR REPLACE FUNCTION fn_shipment_filters(p_type TEXT)
RETURNS JSON AS $$
DECLARE
  tbl TEXT;
  result JSON;
BEGIN
  IF p_type = 'glass' THEN tbl := 'glass_shipments'; ELSE tbl := 'shipments'; END IF;

  EXECUTE format(
    'SELECT json_build_object(
      ''managers'', (SELECT COALESCE(json_agg(v ORDER BY v), ''[]''::json) FROM (SELECT DISTINCT %I.manager AS v FROM %I WHERE manager IS NOT NULL AND manager <> '''') sub),
      ''departments'', (SELECT COALESCE(json_agg(v ORDER BY v), ''[]''::json) FROM (SELECT DISTINCT %I.department AS v FROM %I WHERE department IS NOT NULL AND department <> '''') sub),
      ''businessTypes'', (SELECT COALESCE(json_agg(v ORDER BY v), ''[]''::json) FROM (SELECT DISTINCT %I.business_type AS v FROM %I WHERE business_type IS NOT NULL AND business_type <> '''') sub),
      ''dateRange'', json_build_object(
        ''min'', (SELECT MIN(ship_date)::TEXT FROM %I WHERE ship_date IS NOT NULL),
        ''max'', (SELECT MAX(ship_date)::TEXT FROM %I WHERE ship_date IS NOT NULL)
      )
    )',
    tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── fn_client_analysis ──
CREATE OR REPLACE FUNCTION fn_client_analysis(
  p_type TEXT,
  p_manager TEXT DEFAULT '',
  p_department TEXT DEFAULT '',
  p_business_type TEXT DEFAULT '',
  p_start_date TEXT DEFAULT '',
  p_end_date TEXT DEFAULT '',
  p_client_search TEXT DEFAULT ''
)
RETURNS JSON AS $$
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
  IF p_start_date <> '' THEN where_clause := where_clause || format(' AND ship_date >= %L::date', p_start_date); END IF;
  IF p_end_date <> '' THEN where_clause := where_clause || format(' AND ship_date <= %L::date', p_end_date); END IF;
  IF p_client_search <> '' THEN where_clause := where_clause || format(' AND client_name ILIKE %L', '%%' || p_client_search || '%%'); END IF;

  -- 이전 기간 계산
  IF p_start_date <> '' AND p_end_date <> '' THEN
    days_diff := (p_end_date::date - p_start_date::date);
    prev_end := (p_start_date::date - 1)::TEXT;
    prev_start := (p_start_date::date - 1 - days_diff)::TEXT;
    prev_where := where_clause;
    prev_where := replace(prev_where, format('ship_date >= %L::date', p_start_date), format('ship_date >= %L::date', prev_start));
    prev_where := replace(prev_where, format('ship_date <= %L::date', p_end_date), format('ship_date <= %L::date', prev_end));
  END IF;

  EXECUTE format(
    'WITH filtered AS (SELECT * FROM %I %s),
     summary AS (
       SELECT COALESCE(SUM(supply_amount),0) AS total_revenue,
              COALESCE(SUM(quantity),0) AS total_quantity,
              COUNT(*) AS total_count
       FROM filtered
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
       SELECT ship_date::TEXT AS date, COALESCE(SUM(supply_amount),0) AS revenue
       FROM filtered WHERE ship_date IS NOT NULL
       GROUP BY ship_date ORDER BY ship_date
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
       ''summary'', (SELECT row_to_json(s) FROM summary s),
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
    p_type, p_type, p_type, p_type,
    inv_tbl, inv_tbl, inv_tbl
  ) INTO result;

  -- 이전 기간 순위 추가
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── fn_client_detail ──
CREATE OR REPLACE FUNCTION fn_client_detail(
  p_type TEXT,
  p_client_code TEXT,
  p_start_date TEXT DEFAULT '',
  p_end_date TEXT DEFAULT ''
)
RETURNS JSON AS $$
DECLARE
  tbl TEXT;
  inv_tbl TEXT;
  where_clause TEXT;
  result JSON;
BEGIN
  IF p_type = 'glass' THEN tbl := 'glass_shipments'; inv_tbl := 'inventory_dl';
  ELSE tbl := 'shipments'; inv_tbl := 'inventory_cdv'; END IF;

  where_clause := format('WHERE client_code = %L', p_client_code);
  IF p_start_date <> '' THEN where_clause := where_clause || format(' AND ship_date >= %L::date', p_start_date); END IF;
  IF p_end_date <> '' THEN where_clause := where_clause || format(' AND ship_date <= %L::date', p_end_date); END IF;

  EXECUTE format(
    'SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.revenue DESC), ''[]''::json)
     FROM (
       SELECT s.item_no, s.item_name,
              COALESCE(SUM(s.quantity),0) AS quantity,
              COALESCE(SUM(s.supply_amount),0) AS revenue,
              COUNT(*) AS count,
              i.supply_price AS "supplyPrice",
              CASE WHEN SUM(s.quantity) > 0 AND SUM(CASE WHEN s.selling_price > 0 THEN s.selling_price * s.quantity ELSE 0 END) > 0
                THEN ROUND(SUM(CASE WHEN s.selling_price > 0 THEN s.selling_price * s.quantity ELSE 0 END) / NULLIF(SUM(s.quantity),0))
                ELSE NULL END AS "avgSellingPrice",
              CASE WHEN i.supply_price > 0 AND SUM(s.quantity) > 0
                   AND SUM(CASE WHEN s.selling_price > 0 THEN s.selling_price * s.quantity ELSE 0 END) > 0
                THEN ROUND(((i.supply_price * SUM(s.quantity)
                   - SUM(CASE WHEN s.selling_price > 0 THEN s.selling_price * s.quantity ELSE 0 END))
                   / NULLIF(i.supply_price * SUM(s.quantity),0)) * 1000) / 10.0
                ELSE NULL END AS "discountRate"
       FROM %I s LEFT JOIN %I i ON s.item_no = i.item_no
       %s
       GROUP BY s.item_no, s.item_name, i.supply_price
     ) sub',
    tbl, inv_tbl, where_clause
  ) INTO result;

  RETURN json_build_object('clientItems', result);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── fn_inventory_summary_cdv ──
CREATE OR REPLACE FUNCTION fn_inventory_summary_cdv()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'byCountry', (
      SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) FROM (
        SELECT COALESCE(NULLIF(country,''), '(미분류)') AS name,
               SUM((COALESCE(bonded_warehouse,0) + COALESCE(yongma_logistics,0)) * COALESCE(supply_price,0)) AS value
        FROM inventory_cdv
        WHERE (COALESCE(bonded_warehouse,0) + COALESCE(yongma_logistics,0)) * COALESCE(supply_price,0) > 0
        GROUP BY 1 ORDER BY value DESC LIMIT 15
      ) sub
    ),
    'byBrand', (
      SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) FROM (
        SELECT CASE WHEN split_part(item_name, ' ', 1) ~ '^[A-Za-z]{2,4}$'
                    THEN upper(split_part(item_name, ' ', 1))
                    ELSE '(기타)' END AS name,
               SUM((COALESCE(bonded_warehouse,0) + COALESCE(yongma_logistics,0)) * COALESCE(supply_price,0)) AS value
        FROM inventory_cdv
        WHERE (COALESCE(bonded_warehouse,0) + COALESCE(yongma_logistics,0)) * COALESCE(supply_price,0) > 0
        GROUP BY 1 ORDER BY value DESC LIMIT 15
      ) sub
    ),
    'byItem', (
      SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) FROM (
        SELECT i.item_no AS "itemNo", i.item_name AS name,
               (COALESCE(i.bonded_warehouse,0) + COALESCE(i.yongma_logistics,0)) AS qty,
               (COALESCE(i.bonded_warehouse,0) + COALESCE(i.yongma_logistics,0)) * COALESCE(i.supply_price,0) AS value,
               COALESCE(s30.qty, 0) AS "ship30",
               COALESCE(s90.qty, 0) AS "ship90"
        FROM inventory_cdv i
        LEFT JOIN (
          SELECT item_no, COALESCE(SUM(quantity),0) AS qty
          FROM shipments WHERE ship_date::date >= CURRENT_DATE - 30
          GROUP BY item_no
        ) s30 ON i.item_no = s30.item_no
        LEFT JOIN (
          SELECT item_no, COALESCE(SUM(quantity),0) AS qty
          FROM shipments WHERE ship_date::date >= CURRENT_DATE - 90
          GROUP BY item_no
        ) s90 ON i.item_no = s90.item_no
        WHERE (COALESCE(i.bonded_warehouse,0) + COALESCE(i.yongma_logistics,0)) * COALESCE(i.supply_price,0) > 0
        ORDER BY value DESC LIMIT 30
      ) sub
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── fn_inventory_summary_dl ──
CREATE OR REPLACE FUNCTION fn_inventory_summary_dl()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'byCountry', (
      SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) FROM (
        SELECT COALESCE(NULLIF(country,''), '(미분류)') AS name,
               SUM((COALESCE(anseong_warehouse,0) + COALESCE(gig_warehouse,0) + COALESCE(gig_marketing,0) + COALESCE(gig_sales1,0)) * COALESCE(supply_price,0)) AS value
        FROM inventory_dl
        WHERE (COALESCE(anseong_warehouse,0) + COALESCE(gig_warehouse,0) + COALESCE(gig_marketing,0) + COALESCE(gig_sales1,0)) * COALESCE(supply_price,0) > 0
        GROUP BY 1 ORDER BY value DESC LIMIT 15
      ) sub
    ),
    'byBrand', (
      SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) FROM (
        SELECT CASE WHEN upper(split_part(item_name, ' ', 1)) = 'RD' AND (regexp_match(split_part(item_name, ' ', 2), '(\d{3,5})'))[1] IS NOT NULL
                    THEN (regexp_match(split_part(item_name, ' ', 2), '(\d{3,5})'))[1]
                    ELSE '(기타)' END AS name,
               SUM((COALESCE(anseong_warehouse,0) + COALESCE(gig_warehouse,0) + COALESCE(gig_marketing,0) + COALESCE(gig_sales1,0)) * COALESCE(supply_price,0)) AS value
        FROM inventory_dl
        WHERE (COALESCE(anseong_warehouse,0) + COALESCE(gig_warehouse,0) + COALESCE(gig_marketing,0) + COALESCE(gig_sales1,0)) * COALESCE(supply_price,0) > 0
        GROUP BY 1 ORDER BY value DESC LIMIT 15
      ) sub
    ),
    'byItem', (
      SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) FROM (
        SELECT i.item_no AS "itemNo", i.item_name AS name,
               (COALESCE(i.anseong_warehouse,0) + COALESCE(i.gig_warehouse,0) + COALESCE(i.gig_marketing,0) + COALESCE(i.gig_sales1,0)) AS qty,
               (COALESCE(i.anseong_warehouse,0) + COALESCE(i.gig_warehouse,0) + COALESCE(i.gig_marketing,0) + COALESCE(i.gig_sales1,0)) * COALESCE(i.supply_price,0) AS value,
               COALESCE(s30.qty, 0) AS "ship30",
               COALESCE(s90.qty, 0) AS "ship90"
        FROM inventory_dl i
        LEFT JOIN (
          SELECT item_no, COALESCE(SUM(quantity),0) AS qty
          FROM glass_shipments WHERE ship_date::date >= CURRENT_DATE - 30
          GROUP BY item_no
        ) s30 ON i.item_no = s30.item_no
        LEFT JOIN (
          SELECT item_no, COALESCE(SUM(quantity),0) AS qty
          FROM glass_shipments WHERE ship_date::date >= CURRENT_DATE - 90
          GROUP BY item_no
        ) s90 ON i.item_no = s90.item_no
        WHERE (COALESCE(i.anseong_warehouse,0) + COALESCE(i.gig_warehouse,0) + COALESCE(i.gig_marketing,0) + COALESCE(i.gig_sales1,0)) * COALESCE(i.supply_price,0) > 0
        ORDER BY value DESC LIMIT 30
      ) sub
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── fn_manager_brands ──
CREATE OR REPLACE FUNCTION fn_manager_brands(
  p_type TEXT,
  p_manager TEXT DEFAULT '',
  p_department TEXT DEFAULT '',
  p_business_type TEXT DEFAULT '',
  p_start_date TEXT DEFAULT '',
  p_end_date TEXT DEFAULT '',
  p_client_search TEXT DEFAULT ''
)
RETURNS JSON AS $$
DECLARE
  tbl TEXT;
  where_clause TEXT := 'WHERE 1=1';
  result JSON;
BEGIN
  IF p_type = 'glass' THEN tbl := 'glass_shipments'; ELSE tbl := 'shipments'; END IF;

  IF p_manager <> '' THEN where_clause := where_clause || format(' AND manager = %L', p_manager); END IF;
  IF p_department <> '' THEN where_clause := where_clause || format(' AND department = %L', p_department); END IF;
  IF p_business_type <> '' THEN where_clause := where_clause || format(' AND business_type = %L', p_business_type); END IF;
  IF p_start_date <> '' THEN where_clause := where_clause || format(' AND ship_date >= %L::date', p_start_date); END IF;
  IF p_end_date <> '' THEN where_clause := where_clause || format(' AND ship_date <= %L::date', p_end_date); END IF;
  IF p_client_search <> '' THEN where_clause := where_clause || format(' AND client_name ILIKE %L', '%%' || p_client_search || '%%'); END IF;

  EXECUTE format(
    'SELECT COALESCE(json_object_agg(mgr, detail), ''{}''::json)
     FROM (
       SELECT mgr, json_build_object(
         ''brands'', (
           SELECT COALESCE(json_agg(json_build_object(''brand'', brand, ''revenue'', rev) ORDER BY rev DESC), ''[]''::json)
           FROM (
             SELECT CASE
               WHEN %L = ''glass'' AND upper(split_part(item_name, '' '', 1)) = ''RD''
                 THEN (regexp_match(split_part(item_name, '' '', 2), ''(\d{3,5})''))[1]
               WHEN %L <> ''glass'' AND split_part(item_name, '' '', 1) ~ ''^[A-Za-z]{2,4}$''
                 THEN upper(split_part(item_name, '' '', 1))
               ELSE NULL END AS brand,
               SUM(supply_amount) AS rev
             FROM %I sub2 %s AND COALESCE(NULLIF(sub2.manager,''''),''(미지정)'') = mgr
             GROUP BY 1 HAVING CASE
               WHEN %L = ''glass'' AND upper(split_part(item_name, '' '', 1)) = ''RD''
                 THEN (regexp_match(split_part(item_name, '' '', 2), ''(\d{3,5})''))[1]
               WHEN %L <> ''glass'' AND split_part(item_name, '' '', 1) ~ ''^[A-Za-z]{2,4}$''
                 THEN upper(split_part(item_name, '' '', 1))
               ELSE NULL END IS NOT NULL
             ORDER BY rev DESC LIMIT 10
           ) br
         ),
         ''bizClients'', (
           SELECT COALESCE(json_agg(json_build_object(''biz'', biz, ''count'', cnt) ORDER BY cnt DESC), ''[]''::json)
           FROM (
             SELECT CASE WHEN business_type IS NULL OR business_type = '''' THEN ''(미분류)''
                    WHEN position(''/'' in business_type) > 0 THEN substring(business_type from position(''/'' in business_type)+1)
                    ELSE business_type END AS biz,
                    COUNT(DISTINCT client_code) AS cnt
             FROM %I sub3 %s AND COALESCE(NULLIF(sub3.manager,''''),''(미지정)'') = mgr
             GROUP BY 1 ORDER BY cnt DESC
           ) bc
         )
       ) AS detail
       FROM (SELECT DISTINCT COALESCE(NULLIF(manager,''''),''(미지정)'') AS mgr FROM %I %s) managers
     ) agg',
    p_type, p_type,
    tbl, where_clause,
    p_type, p_type,
    tbl, where_clause,
    tbl, where_clause
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
