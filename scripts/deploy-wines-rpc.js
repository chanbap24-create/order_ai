// scripts/deploy-wines-rpc.js
// fn_wines_list RPC 배포

const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const vars = {};
env.split('\n').forEach(l => {
  const idx = l.indexOf('=');
  if (idx > 0) vars[l.substring(0, idx).trim()] = l.substring(idx + 1).trim();
});
const token = vars.SUPABASE_ACCESS_TOKEN;

async function deploy(sql) {
  const res = await fetch('https://api.supabase.com/v1/projects/nunuyropsfoaafkustli/database/query', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(res.status + ': ' + t);
  }
  return res.json();
}

const fn_wines_list = `
CREATE OR REPLACE FUNCTION fn_wines_list(
  p_search TEXT DEFAULT '',
  p_country TEXT DEFAULT '',
  p_status TEXT DEFAULT '',
  p_hide_zero BOOL DEFAULT false,
  p_sort_by TEXT DEFAULT '',
  p_sort_dir TEXT DEFAULT 'desc',
  p_page INT DEFAULT 1,
  p_limit INT DEFAULT 50
)
RETURNS JSON AS $$
DECLARE
  where_clause TEXT := 'WHERE 1=1';
  order_clause TEXT;
  result JSON;
  v_offset INT;
  sortable TEXT[] := ARRAY['item_code','country_en','region','brand','item_name_kr','item_name_en','supply_price','available_stock'];
BEGIN
  v_offset := (p_page - 1) * p_limit;

  IF p_search <> '' THEN
    where_clause := where_clause || format(
      ' AND (w.item_code ILIKE %L OR w.item_name_kr ILIKE %L OR w.item_name_en ILIKE %L OR w.brand ILIKE %L OR w.country ILIKE %L OR w.country_en ILIKE %L)',
      '%%'||p_search||'%%', '%%'||p_search||'%%', '%%'||p_search||'%%',
      '%%'||p_search||'%%', '%%'||p_search||'%%', '%%'||p_search||'%%'
    );
  END IF;
  IF p_country <> '' THEN
    where_clause := where_clause || format(' AND (w.country = %L OR w.country_en = %L)', p_country, p_country);
  END IF;
  IF p_status <> '' THEN
    where_clause := where_clause || format(' AND w.status = %L', p_status);
  END IF;
  IF p_hide_zero THEN
    where_clause := where_clause || ' AND (COALESCE(w.available_stock,0) + COALESCE(inv.bonded_warehouse,0)) > 0';
  END IF;

  IF p_sort_by <> '' AND p_sort_by = ANY(sortable) THEN
    IF p_sort_dir = 'asc' THEN
      order_clause := format('ORDER BY %I ASC NULLS LAST', p_sort_by);
    ELSE
      order_clause := format('ORDER BY %I DESC NULLS LAST', p_sort_by);
    END IF;
  ELSE
    order_clause := 'ORDER BY ';
    IF p_search <> '' AND length(p_search) BETWEEN 2 AND 4 AND p_search ~ '^[A-Za-z]+$' THEN
      order_clause := order_clause || format('CASE WHEN upper(brand) = upper(%L) THEN 0 ELSE 1 END, ', p_search);
    END IF;
    order_clause := order_clause || '
      CASE COALESCE(NULLIF(country_en,''''), country, '''')
        WHEN ''England'' THEN 0 WHEN ''France'' THEN 1 WHEN ''Italy'' THEN 2
        WHEN ''Spain'' THEN 3 WHEN ''Portugal'' THEN 4 WHEN ''USA'' THEN 5
        WHEN ''Chile'' THEN 6 WHEN ''Argentina'' THEN 7 WHEN ''Australia'' THEN 8
        WHEN ''New Zealand'' THEN 9 WHEN ''NewZealand'' THEN 9
        ELSE 99 END,
      CASE upper(COALESCE(brand,''''))
        WHEN ''RF'' THEN 0 WHEN ''CH'' THEN 1 WHEN ''SU'' THEN 2 WHEN ''LG'' THEN 3
        WHEN ''CP'' THEN 4 WHEN ''HG'' THEN 5 WHEN ''MA'' THEN 6 WHEN ''WM'' THEN 7
        WHEN ''VA'' THEN 8 WHEN ''DA'' THEN 9 WHEN ''LR'' THEN 10 WHEN ''BL'' THEN 11
        WHEN ''DD'' THEN 12 WHEN ''VG'' THEN 13 WHEN ''RB'' THEN 14 WHEN ''MG'' THEN 15
        WHEN ''CC'' THEN 16 WHEN ''LM'' THEN 17 WHEN ''CL'' THEN 18 WHEN ''JP'' THEN 19
        WHEN ''DF'' THEN 20 WHEN ''CD'' THEN 21 WHEN ''GA'' THEN 22 WHEN ''DP'' THEN 23
        WHEN ''CF'' THEN 24 WHEN ''MD'' THEN 25 WHEN ''CA'' THEN 26 WHEN ''PE'' THEN 27
        WHEN ''BO'' THEN 28 WHEN ''AS'' THEN 29 WHEN ''EF'' THEN 30 WHEN ''VP'' THEN 31
        WHEN ''OR'' THEN 32 WHEN ''BS'' THEN 33 WHEN ''AT'' THEN 34 WHEN ''IG'' THEN 35
        WHEN ''MM'' THEN 36 WHEN ''JC'' THEN 37 WHEN ''SM'' THEN 38 WHEN ''ST'' THEN 39
        WHEN ''CO'' THEN 40 WHEN ''GH'' THEN 41 WHEN ''BM'' THEN 42 WHEN ''LS'' THEN 43
        WHEN ''FP'' THEN 44 WHEN ''AR'' THEN 45 WHEN ''LT'' THEN 46 WHEN ''FL'' THEN 47
        WHEN ''PS'' THEN 48 WHEN ''RG'' THEN 49 WHEN ''RE'' THEN 50 WHEN ''RT'' THEN 51
        WHEN ''SV'' THEN 52 WHEN ''CR'' THEN 53 WHEN ''RL'' THEN 54 WHEN ''PF'' THEN 55
        WHEN ''GC'' THEN 56 WHEN ''GF'' THEN 57 WHEN ''MB'' THEN 58 WHEN ''AD'' THEN 59
        WHEN ''PR'' THEN 60 WHEN ''AC'' THEN 61 WHEN ''LB'' THEN 62 WHEN ''SS'' THEN 63
        WHEN ''HP'' THEN 64 WHEN ''EM'' THEN 65 WHEN ''CK'' THEN 66 WHEN ''RO'' THEN 67
        WHEN ''LC'' THEN 68 ELSE 999 END,
      COALESCE(supply_price,0) DESC NULLS LAST';
  END IF;

  EXECUTE format(
    'WITH base AS (
       SELECT w.*,
              COALESCE(inv.bonded_warehouse, 0) AS bonded_stock,
              tn.id AS tasting_note_id,
              tn.ai_generated,
              tn.approved
       FROM wines w
       LEFT JOIN inventory_cdv inv ON inv.item_no = w.item_code
       LEFT JOIN LATERAL (
         SELECT id, ai_generated, approved FROM tasting_notes WHERE wine_id = w.item_code LIMIT 1
       ) tn ON true
       %s
     ),
     counted AS (SELECT COUNT(*) AS total FROM base),
     countries AS (
       SELECT COALESCE(NULLIF(country_en,''''), country, '''') AS name, COUNT(*) AS cnt
       FROM base
       WHERE COALESCE(NULLIF(country_en,''''), country, '''') <> ''''
       GROUP BY 1 ORDER BY cnt DESC
     )
     SELECT json_build_object(
       ''total'', (SELECT total FROM counted),
       ''countries'', (SELECT COALESCE(json_agg(json_build_object(''name'', name, ''cnt'', cnt)), ''[]''::json) FROM countries),
       ''wines'', (SELECT COALESCE(json_agg(row_to_json(p)), ''[]''::json) FROM (
         SELECT * FROM base %s LIMIT %s OFFSET %s
       ) p)
     )',
    where_clause, order_clause, p_limit, v_offset
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

deploy(fn_wines_list)
  .then(() => console.log('OK: fn_wines_list'))
  .catch(e => console.log('FAIL:', e.message));
