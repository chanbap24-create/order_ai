// scripts/deploy-client-analysis-rpc.js
// fn_client_wine_analysis + fn_client_suggestions RPC 배포

const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const vars = {};
env.split('\n').forEach(l => {
  const idx = l.indexOf('=');
  if (idx > 0) vars[l.substring(0, idx).trim()] = l.substring(idx + 1).trim();
});
const token = vars.SUPABASE_ACCESS_TOKEN;

async function deploy(name, sql) {
  const res = await fetch('https://api.supabase.com/v1/projects/nunuyropsfoaafkustli/database/query', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(res.status + ': ' + t);
  }
  const r = await res.json();
  console.log('OK:', name);
  return r;
}

// ── fn_client_wine_analysis ──
// p_type: 'wine' (CDV) | 'glass' (DL)
const fn_client_wine_analysis = `
CREATE OR REPLACE FUNCTION fn_client_wine_analysis(
  p_type TEXT DEFAULT 'wine',
  p_manager TEXT DEFAULT '',
  p_department TEXT DEFAULT '',
  p_client TEXT DEFAULT '',
  p_start TEXT DEFAULT '',
  p_end TEXT DEFAULT ''
)
RETURNS JSON AS $$
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
BEGIN
  is_wine := (p_type <> 'glass');
  IF is_wine THEN ship_tbl := 'shipments'; inv_tbl := 'inventory_cdv';
  ELSE ship_tbl := 'glass_shipments'; inv_tbl := 'inventory_dl'; END IF;

  IF p_manager <> '' THEN where_clause := where_clause || format(' AND s.manager = %L', p_manager); END IF;
  IF p_department <> '' THEN where_clause := where_clause || format(' AND s.department = %L', p_department); END IF;
  IF p_client <> '' THEN where_clause := where_clause || format(' AND s.client_code = %L', p_client); END IF;
  IF p_start <> '' THEN where_clause := where_clause || format(' AND s.ship_date::date >= %L::date', p_start); END IF;
  IF p_end <> '' THEN where_clause := where_clause || format(' AND s.ship_date::date <= %L::date', p_end); END IF;

  -- 이전 기간 계산
  IF p_start <> '' AND p_end <> '' THEN
    days_diff := (p_end::date - p_start::date);
    prev_end := (p_start::date - 1)::TEXT;
    prev_start := (p_start::date - 1 - days_diff)::TEXT;
    prev_where := replace(where_clause, format('s.ship_date::date >= %L::date', p_start), format('s.ship_date::date >= %L::date', prev_start));
    prev_where := replace(prev_where, format('s.ship_date::date <= %L::date', p_end), format('s.ship_date::date <= %L::date', prev_end));
  END IF;

  IF is_wine THEN
    -- ── CDV: wines 테이블 JOIN (국가/지역/품종/타입 분석 가능) ──
    EXECUTE format(
      'WITH filtered AS (
         SELECT s.item_no, s.item_name, s.quantity, s.selling_price, s.supply_amount,
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
         SELECT COALESCE(SUM(supply_amount),0) AS "totalRevenue",
                CASE WHEN SUM(CASE WHEN base_price > 0 AND selling_price > 0 AND quantity > 0
                          THEN base_price * quantity ELSE 0 END) > 0
                     THEN ROUND(((SUM(CASE WHEN base_price > 0 AND selling_price > 0 AND quantity > 0
                          THEN base_price * quantity ELSE 0 END)
                          - SUM(CASE WHEN base_price > 0 AND selling_price > 0 AND quantity > 0
                          THEN selling_price * quantity ELSE 0 END))
                          / NULLIF(SUM(CASE WHEN base_price > 0 AND selling_price > 0 AND quantity > 0
                          THEN base_price * quantity ELSE 0 END),0)) * 1000) / 10.0
                ELSE 0 END AS "avgDiscount"
         FROM filtered
       ),
       by_country AS (
         SELECT CASE WHEN country = '''' THEN ''(미분류)'' ELSE country END AS name,
                COALESCE(SUM(supply_amount),0) AS value
         FROM filtered GROUP BY 1 ORDER BY value DESC LIMIT 10
       ),
       by_region AS (
         SELECT CASE WHEN region = '''' THEN ''(미분류)'' ELSE region END AS name,
                COALESCE(SUM(supply_amount),0) AS value
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
           COALESCE(SUM(supply_amount),0) AS value
         FROM filtered GROUP BY 1 ORDER BY value DESC
       ),
       by_grape AS (
         SELECT trim(g) AS name, COALESCE(SUM(supply_amount),0) AS value
         FROM filtered, unnest(string_to_array(grape_varieties, '','')) AS g
         WHERE grape_varieties <> ''''
         GROUP BY 1 ORDER BY value DESC LIMIT 10
       ),
       by_price AS (
         SELECT (FLOOR(base_price / 10000) * 10000)::BIGINT AS band,
                COALESCE(SUM(supply_amount),0) AS value,
                COUNT(DISTINCT item_no) AS cnt
         FROM filtered WHERE base_price > 0
         GROUP BY 1 ORDER BY band
       ),
       item_agg AS (
         SELECT item_no AS code, MAX(item_name) AS name,
                COALESCE(SUM(supply_amount),0) AS revenue,
                CASE WHEN SUM(CASE WHEN base_price > 0 AND selling_price > 0 AND quantity > 0
                          THEN base_price * quantity ELSE 0 END) > 0
                     THEN ROUND(((SUM(CASE WHEN base_price > 0 AND selling_price > 0 AND quantity > 0
                          THEN base_price * quantity ELSE 0 END)
                          - SUM(CASE WHEN base_price > 0 AND selling_price > 0 AND quantity > 0
                          THEN selling_price * quantity ELSE 0 END))
                          / NULLIF(SUM(CASE WHEN base_price > 0 AND selling_price > 0 AND quantity > 0
                          THEN base_price * quantity ELSE 0 END),0)) * 1000) / 10.0
                ELSE 0 END AS discount,
                COALESCE(SUM(quantity),0) AS quantity,
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
      ship_tbl, inv_tbl, where_clause
    ) INTO result;

  ELSE
    -- ── DL: glass_items / inventory_dl (국가/지역/품종/타입 없음) ──
    EXECUTE format(
      'WITH filtered AS (
         SELECT s.item_no, s.item_name, s.quantity, s.selling_price, s.supply_amount,
                COALESCE(inv.supply_price, gi.supply_price, 0) AS base_price,
                COALESCE(inv.available_stock, 0) AS remaining_stock
         FROM %I s
         LEFT JOIN glass_items gi ON gi.item_no = s.item_no
         LEFT JOIN %I inv ON inv.item_no = s.item_no
         %s
       ),
       summary AS (
         SELECT COALESCE(SUM(supply_amount),0) AS "totalRevenue",
                CASE WHEN SUM(CASE WHEN base_price > 0 AND selling_price > 0 AND quantity > 0
                          THEN base_price * quantity ELSE 0 END) > 0
                     THEN ROUND(((SUM(CASE WHEN base_price > 0 AND selling_price > 0 AND quantity > 0
                          THEN base_price * quantity ELSE 0 END)
                          - SUM(CASE WHEN base_price > 0 AND selling_price > 0 AND quantity > 0
                          THEN selling_price * quantity ELSE 0 END))
                          / NULLIF(SUM(CASE WHEN base_price > 0 AND selling_price > 0 AND quantity > 0
                          THEN base_price * quantity ELSE 0 END),0)) * 1000) / 10.0
                ELSE 0 END AS "avgDiscount"
         FROM filtered
       ),
       by_price AS (
         SELECT (FLOOR(base_price / 10000) * 10000)::BIGINT AS band,
                COALESCE(SUM(supply_amount),0) AS value,
                COUNT(DISTINCT item_no) AS cnt
         FROM filtered WHERE base_price > 0
         GROUP BY 1 ORDER BY band
       ),
       item_agg AS (
         SELECT item_no AS code, MAX(item_name) AS name,
                COALESCE(SUM(supply_amount),0) AS revenue,
                CASE WHEN SUM(CASE WHEN base_price > 0 AND selling_price > 0 AND quantity > 0
                          THEN base_price * quantity ELSE 0 END) > 0
                     THEN ROUND(((SUM(CASE WHEN base_price > 0 AND selling_price > 0 AND quantity > 0
                          THEN base_price * quantity ELSE 0 END)
                          - SUM(CASE WHEN base_price > 0 AND selling_price > 0 AND quantity > 0
                          THEN selling_price * quantity ELSE 0 END))
                          / NULLIF(SUM(CASE WHEN base_price > 0 AND selling_price > 0 AND quantity > 0
                          THEN base_price * quantity ELSE 0 END),0)) * 1000) / 10.0
                ELSE 0 END AS discount,
                COALESCE(SUM(quantity),0) AS quantity,
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
      ship_tbl, inv_tbl, where_clause
    ) INTO result;
  END IF;

  -- 이전 기간 매출 + 할인률 + 품목 순위
  IF prev_where <> '' THEN
    DECLARE
      prev_rev NUMERIC;
      prev_disc NUMERIC;
      prev_ranks JSON;
      prev_join TEXT;
    BEGIN
      IF is_wine THEN
        prev_join := format(
          'FROM %I s LEFT JOIN wines w ON w.item_code = s.item_no LEFT JOIN %I inv ON inv.item_no = s.item_no',
          ship_tbl, inv_tbl);
      ELSE
        prev_join := format(
          'FROM %I s LEFT JOIN glass_items gi ON gi.item_no = s.item_no LEFT JOIN %I inv ON inv.item_no = s.item_no',
          ship_tbl, inv_tbl);
      END IF;

      IF is_wine THEN
        EXECUTE format(
          'SELECT COALESCE(SUM(s.supply_amount),0),
                  CASE WHEN SUM(CASE WHEN COALESCE(w.supply_price, inv.supply_price, 0) > 0 AND s.selling_price > 0 AND s.quantity > 0
                       THEN COALESCE(w.supply_price, inv.supply_price, 0) * s.quantity ELSE 0 END) > 0
                       THEN ROUND(((SUM(CASE WHEN COALESCE(w.supply_price, inv.supply_price, 0) > 0 AND s.selling_price > 0 AND s.quantity > 0
                       THEN COALESCE(w.supply_price, inv.supply_price, 0) * s.quantity ELSE 0 END)
                       - SUM(CASE WHEN COALESCE(w.supply_price, inv.supply_price, 0) > 0 AND s.selling_price > 0 AND s.quantity > 0
                       THEN s.selling_price * s.quantity ELSE 0 END))
                       / NULLIF(SUM(CASE WHEN COALESCE(w.supply_price, inv.supply_price, 0) > 0 AND s.selling_price > 0 AND s.quantity > 0
                       THEN COALESCE(w.supply_price, inv.supply_price, 0) * s.quantity ELSE 0 END),0)) * 1000) / 10.0
                  ELSE 0 END
           FROM %I s LEFT JOIN wines w ON w.item_code = s.item_no LEFT JOIN %I inv ON inv.item_no = s.item_no %s',
          ship_tbl, inv_tbl, prev_where
        ) INTO prev_rev, prev_disc;
      ELSE
        EXECUTE format(
          'SELECT COALESCE(SUM(s.supply_amount),0),
                  CASE WHEN SUM(CASE WHEN COALESCE(inv.supply_price, gi.supply_price, 0) > 0 AND s.selling_price > 0 AND s.quantity > 0
                       THEN COALESCE(inv.supply_price, gi.supply_price, 0) * s.quantity ELSE 0 END) > 0
                       THEN ROUND(((SUM(CASE WHEN COALESCE(inv.supply_price, gi.supply_price, 0) > 0 AND s.selling_price > 0 AND s.quantity > 0
                       THEN COALESCE(inv.supply_price, gi.supply_price, 0) * s.quantity ELSE 0 END)
                       - SUM(CASE WHEN COALESCE(inv.supply_price, gi.supply_price, 0) > 0 AND s.selling_price > 0 AND s.quantity > 0
                       THEN s.selling_price * s.quantity ELSE 0 END))
                       / NULLIF(SUM(CASE WHEN COALESCE(inv.supply_price, gi.supply_price, 0) > 0 AND s.selling_price > 0 AND s.quantity > 0
                       THEN COALESCE(inv.supply_price, gi.supply_price, 0) * s.quantity ELSE 0 END),0)) * 1000) / 10.0
                  ELSE 0 END
           FROM %I s LEFT JOIN glass_items gi ON gi.item_no = s.item_no LEFT JOIN %I inv ON inv.item_no = s.item_no %s',
          ship_tbl, inv_tbl, prev_where
        ) INTO prev_rev, prev_disc;
      END IF;

      EXECUTE format(
        'SELECT COALESCE(json_object_agg(item_no, rn), ''{}''::json)
         FROM (
           SELECT s.item_no, ROW_NUMBER() OVER (ORDER BY SUM(s.supply_amount) DESC) AS rn
           %s %s
           GROUP BY s.item_no
         ) sub',
        prev_join, prev_where
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

// ── fn_client_suggestions ──
// p_type: 'wine' → clients, 'glass' → glass_clients
const fn_client_suggestions = `
CREATE OR REPLACE FUNCTION fn_client_suggestions(p_query TEXT, p_type TEXT DEFAULT 'wine')
RETURNS JSON AS $$
DECLARE
  tbl TEXT;
  result JSON;
BEGIN
  IF p_type = 'glass' THEN tbl := 'glass_clients'; ELSE tbl := 'clients'; END IF;

  EXECUTE format(
    'SELECT COALESCE(json_agg(row_to_json(sub)), ''[]''::json)
     FROM (
       SELECT client_code AS code, client_name AS name
       FROM %I
       WHERE client_name ILIKE ''%%'' || %L || ''%%''
          OR client_code ILIKE ''%%'' || %L || ''%%''
       ORDER BY client_name
       LIMIT 20
     ) sub',
    tbl, p_query, p_query
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

(async () => {
  try {
    await deploy('fn_client_wine_analysis', fn_client_wine_analysis);
    await deploy('fn_client_suggestions', fn_client_suggestions);
    console.log('\nAll done!');
  } catch (e) {
    console.error('FAIL:', e.message);
    process.exit(1);
  }
})();
