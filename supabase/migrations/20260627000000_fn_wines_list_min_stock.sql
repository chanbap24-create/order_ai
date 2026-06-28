-- 어드민 와인리스트: 가격대(공급가)별 최소 '실재고' 필터.
-- 실재고 = COALESCE(inventory_cdv.available_stock, wines.available_stock, 0).
--   가용재고는 업로드 엑셀 L열(재고수량) = 동기화가 inventory_cdv.available_stock 에 기록. wines.available_stock 는 stale.
-- p_min_stock json {u20k,u50k,u100k,u200k,over} — 해당 가격대 임계치 미만이면 제외. null=무필터.
-- 가격대: ~2만(u20k) / 2~5만(u50k) / 5~10만(u100k) / 10~20만(u200k) / 20만초과(over).
-- 표시 재고도 실재고로 출력(available_stock 을 inventory_cdv 값으로 덮어씀).
DROP FUNCTION IF EXISTS public.fn_wines_list(text, text, text, boolean, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.fn_wines_list(
  p_search text DEFAULT ''::text, p_country text DEFAULT ''::text, p_status text DEFAULT ''::text,
  p_hide_zero boolean DEFAULT true, p_sort_by text DEFAULT ''::text, p_sort_dir text DEFAULT 'desc'::text,
  p_page integer DEFAULT 1, p_limit integer DEFAULT 50,
  p_min_stock json DEFAULT NULL
)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER
AS $function$
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
      '%'||p_search||'%', '%'||p_search||'%', '%'||p_search||'%',
      '%'||p_search||'%', '%'||p_search||'%', '%'||p_search||'%'
    );
  END IF;
  IF p_country <> '' THEN
    where_clause := where_clause || format(' AND (w.country = %L OR w.country_en = %L)', p_country, p_country);
  END IF;
  IF p_status <> '' THEN
    where_clause := where_clause || format(' AND w.status = %L', p_status);
  END IF;
  IF p_hide_zero THEN
    where_clause := where_clause || ' AND (COALESCE(inv.available_stock, w.available_stock, 0) + COALESCE(inv.bonded_warehouse,0)) > 0';
  END IF;
  IF p_min_stock IS NOT NULL THEN
    where_clause := where_clause || format(
      ' AND COALESCE(inv.available_stock, w.available_stock, 0) >= (CASE'
      || ' WHEN COALESCE(w.supply_price,0) <= 20000 THEN %s'
      || ' WHEN COALESCE(w.supply_price,0) <= 50000 THEN %s'
      || ' WHEN COALESCE(w.supply_price,0) <= 100000 THEN %s'
      || ' WHEN COALESCE(w.supply_price,0) <= 200000 THEN %s'
      || ' ELSE %s END)',
      COALESCE((p_min_stock->>'u20k')::int, 0),
      COALESCE((p_min_stock->>'u50k')::int, 0),
      COALESCE((p_min_stock->>'u100k')::int, 0),
      COALESCE((p_min_stock->>'u200k')::int, 0),
      COALESCE((p_min_stock->>'over')::int, 0)
    );
  END IF;

  IF p_sort_by <> '' AND p_sort_by = ANY(sortable) THEN
    order_clause := format('ORDER BY %I %s NULLS LAST', p_sort_by, CASE WHEN p_sort_dir='asc' THEN 'ASC' ELSE 'DESC' END);
  ELSE
    order_clause := 'ORDER BY ';
    IF p_search <> '' AND length(p_search) BETWEEN 2 AND 4 AND p_search ~ '^[A-Za-z]+$' THEN
      order_clause := order_clause || format('CASE WHEN upper(brand) = upper(%L) THEN 0 ELSE 1 END, ', p_search);
    END IF;
    order_clause := order_clause || '
      CASE COALESCE(NULLIF(country_en,''''), country, '''')
        WHEN ''England'' THEN 0 WHEN ''United Kingdom'' THEN 0 WHEN ''영국'' THEN 0
        WHEN ''France'' THEN 1 WHEN ''프랑스'' THEN 1
        WHEN ''Italy'' THEN 2 WHEN ''이탈리아'' THEN 2
        WHEN ''Spain'' THEN 3 WHEN ''스페인'' THEN 3
        WHEN ''Portugal'' THEN 4 WHEN ''포르투갈'' THEN 4
        WHEN ''USA'' THEN 5 WHEN ''미국'' THEN 5 WHEN ''United States'' THEN 5
        WHEN ''Chile'' THEN 6 WHEN ''칠레'' THEN 6
        WHEN ''Argentina'' THEN 7 WHEN ''아르헨티나'' THEN 7
        WHEN ''Australia'' THEN 8 WHEN ''호주'' THEN 8
        WHEN ''New Zealand'' THEN 9 WHEN ''NewZealand'' THEN 9 WHEN ''뉴질랜드'' THEN 9
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
              inv.available_stock AS inv_avail,
              COALESCE(inv.bonded_warehouse, 0) AS bonded_stock,
              tn.id AS tasting_note_id, tn.ai_generated, tn.approved
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
       FROM base WHERE COALESCE(NULLIF(country_en,''''), country, '''') <> ''''
       GROUP BY 1 ORDER BY cnt DESC
     )
     SELECT json_build_object(
       ''total'', (SELECT total FROM counted),
       ''countries'', (SELECT COALESCE(json_agg(json_build_object(''name'', name, ''cnt'', cnt)), ''[]''::json) FROM countries),
       ''wines'', (SELECT COALESCE(json_agg(
            (to_jsonb(p) - ''inv_avail'') || jsonb_build_object(''available_stock'', COALESCE(p.inv_avail, p.available_stock, 0))
          ), ''[]''::json) FROM (
         SELECT * FROM base %s LIMIT %s OFFSET %s
       ) p)
     )',
    where_clause, order_clause, p_limit, v_offset
  ) INTO result;

  RETURN result;
END;
$function$;