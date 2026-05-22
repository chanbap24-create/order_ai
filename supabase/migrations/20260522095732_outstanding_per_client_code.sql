-- calc_glass_outstanding_v2 / calc_wine_outstanding 재작성
--
-- 두 가지 root cause fix:
-- (1) glass 함수가 client_list 를 glass_client_carryover 에서만 생성 → 출고는
--     있는데 carryover 업로드 안 된 신규 거래처(매니저별 누적 3200건+) 가
--     미수현황에서 통째로 누락됐다. carryover ∪ glass_shipments (manager 일치)
--     UNION 으로 확장.
-- (2) glass/wine 둘 다 name_map/code_to_rep 로 같은 client_name 의 여러
--     client_code 를 1개 rep_code 에 통합하던 로직 제거. 출고현황 엑셀의
--     F열(판매처번호) 별로 독립 row 가 유지되어야 한다(사업자번호 변경 등으로
--     같은 거래처가 코드만 갈리는 케이스를 별도로 표시).
--
-- bigint 캐스트로 수억대 합산 시 integer overflow 방지.

CREATE OR REPLACE FUNCTION public.calc_glass_outstanding_v2(
  p_manager text,
  p_start_date text,
  p_end_date text
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $function$
WITH
ref AS (
  SELECT TO_CHAR(COALESCE(DATE_TRUNC('month', MIN(created_at)), DATE_TRUNC('month', CURRENT_DATE)), 'YYYY-MM-DD') as ref_date
  FROM glass_client_carryover
),
client_list AS (
  SELECT client_code, client_name, COALESCE(carryover_amount, 0)::bigint as carry
  FROM glass_client_carryover WHERE manager = p_manager
  UNION
  SELECT gs.client_code, gs.client_name, 0::bigint as carry
  FROM (
    SELECT DISTINCT ON (client_code) client_code, client_name
    FROM glass_shipments
    WHERE manager = p_manager AND client_code IS NOT NULL AND client_name IS NOT NULL
    ORDER BY client_code, ship_date DESC
  ) gs
  WHERE NOT EXISTS (
    SELECT 1 FROM glass_client_carryover gcc
    WHERE gcc.client_code = gs.client_code AND gcc.manager = p_manager
  )
),
adj_ship AS (
  SELECT gs.client_code, SUM(COALESCE(gs.total_amount,0))::bigint as total
  FROM glass_shipments gs
  WHERE gs.client_code IN (SELECT client_code FROM client_list)
    AND gs.ship_date::date >= LEAST((SELECT ref_date FROM ref)::date, p_start_date::date)
    AND gs.ship_date::date <  GREATEST((SELECT ref_date FROM ref)::date, p_start_date::date)
  GROUP BY gs.client_code
),
adj_pay AS (
  SELECT gp.client_code, SUM(COALESCE(gp.amount,0))::bigint as total
  FROM glass_payments gp
  WHERE gp.client_code IN (SELECT client_code FROM client_list)
    AND gp.payment_date::date >= LEAST((SELECT ref_date FROM ref)::date, p_start_date::date)
    AND gp.payment_date::date <  GREATEST((SELECT ref_date FROM ref)::date, p_start_date::date)
  GROUP BY gp.client_code
),
sales AS (
  SELECT gs.client_code,
         SUM(COALESCE(gs.supply_amount,0))::bigint as supply,
         SUM(COALESCE(gs.tax_amount,0))::bigint    as tax,
         SUM(COALESCE(gs.total_amount,0))::bigint  as total
  FROM glass_shipments gs
  WHERE gs.client_code IN (SELECT client_code FROM client_list)
    AND gs.ship_date::date >= p_start_date::date
    AND gs.ship_date::date <= p_end_date::date
  GROUP BY gs.client_code
),
pays AS (
  SELECT gp.client_code, SUM(COALESCE(gp.amount,0))::bigint as payment
  FROM glass_payments gp
  WHERE gp.client_code IN (SELECT client_code FROM client_list)
    AND gp.payment_date::date >= p_start_date::date
    AND gp.payment_date::date <= p_end_date::date
  GROUP BY gp.client_code
),
final AS (
  SELECT cl.client_code, cl.client_name,
    CASE WHEN (SELECT ref_date FROM ref) <= p_start_date
      THEN cl.carry + COALESCE(ash.total,0) - COALESCE(ap.total,0)
      ELSE cl.carry - COALESCE(ash.total,0) + COALESCE(ap.total,0)
    END as prev_balance,
    COALESCE(s.supply,0) as period_supply,
    COALESCE(s.tax,0)    as period_tax,
    COALESCE(s.total,0)  as period_total,
    COALESCE(p.payment,0) as period_payment,
    (CASE WHEN (SELECT ref_date FROM ref) <= p_start_date
      THEN cl.carry + COALESCE(ash.total,0) - COALESCE(ap.total,0)
      ELSE cl.carry - COALESCE(ash.total,0) + COALESCE(ap.total,0)
    END) + COALESCE(s.total,0) - COALESCE(p.payment,0) as outstanding
  FROM client_list cl
  LEFT JOIN adj_ship ash ON cl.client_code = ash.client_code
  LEFT JOIN adj_pay  ap  ON cl.client_code = ap.client_code
  LEFT JOIN sales    s   ON cl.client_code = s.client_code
  LEFT JOIN pays     p   ON cl.client_code = p.client_code
  WHERE ((CASE WHEN (SELECT ref_date FROM ref) <= p_start_date
      THEN cl.carry + COALESCE(ash.total,0) - COALESCE(ap.total,0)
      ELSE cl.carry - COALESCE(ash.total,0) + COALESCE(ap.total,0)
    END) + COALESCE(s.total,0) - COALESCE(p.payment,0)) != 0
    OR COALESCE(s.total,0) != 0
    OR COALESCE(p.payment,0) != 0
)
SELECT COALESCE(jsonb_agg(row_to_json(final)::jsonb ORDER BY outstanding DESC), '[]'::jsonb) FROM final;
$function$;

CREATE OR REPLACE FUNCTION public.calc_wine_outstanding(
  p_manager text,
  p_start_date text,
  p_end_date text
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $function$
WITH
ref AS (
  SELECT TO_CHAR(COALESCE(DATE_TRUNC('month', MIN(created_at)), DATE_TRUNC('month', CURRENT_DATE)), 'YYYY-MM-DD') as ref_date
  FROM client_carryover
),
active_clients AS (
  SELECT client_code, COALESCE(client_name, client_code) as client_name
  FROM client_details
  WHERE manager = p_manager
    AND (client_name IS NULL OR (UPPER(client_name) NOT LIKE '(X)%'))
    AND client_code != COALESCE(client_name, '')
),
carry AS (
  SELECT ac.client_code, SUM(COALESCE(cc.carryover_amount, 0))::bigint as carry
  FROM active_clients ac
  LEFT JOIN client_carryover cc ON cc.client_code = ac.client_code
  GROUP BY ac.client_code
),
adj_ship AS (
  SELECT s.client_code, SUM(COALESCE(s.total_amount, 0))::bigint as total
  FROM shipments s
  WHERE s.client_code IN (SELECT client_code FROM active_clients)
    AND s.ship_date::date >= LEAST((SELECT ref_date FROM ref)::date, p_start_date::date)
    AND s.ship_date::date <  GREATEST((SELECT ref_date FROM ref)::date, p_start_date::date)
  GROUP BY s.client_code
),
adj_pay AS (
  SELECT p.client_code, SUM(COALESCE(p.amount, 0))::bigint as total
  FROM payments p
  WHERE p.client_code IN (SELECT client_code FROM active_clients)
    AND p.payment_date::date >= LEAST((SELECT ref_date FROM ref)::date, p_start_date::date)
    AND p.payment_date::date <  GREATEST((SELECT ref_date FROM ref)::date, p_start_date::date)
  GROUP BY p.client_code
),
sales AS (
  SELECT s.client_code,
         SUM(COALESCE(s.supply_amount, 0))::bigint as supply,
         SUM(COALESCE(s.tax_amount, 0))::bigint    as tax,
         SUM(COALESCE(s.total_amount, 0))::bigint  as total
  FROM shipments s
  WHERE s.client_code IN (SELECT client_code FROM active_clients)
    AND s.ship_date::date >= p_start_date::date
    AND s.ship_date::date <= p_end_date::date
  GROUP BY s.client_code
),
pays AS (
  SELECT p.client_code, SUM(COALESCE(p.amount, 0))::bigint as payment
  FROM payments p
  WHERE p.client_code IN (SELECT client_code FROM active_clients)
    AND p.payment_date::date >= p_start_date::date
    AND p.payment_date::date <= p_end_date::date
  GROUP BY p.client_code
),
final AS (
  SELECT ac.client_code, ac.client_name,
    CASE WHEN (SELECT ref_date FROM ref) <= p_start_date
      THEN COALESCE(c.carry,0) + COALESCE(ash.total,0) - COALESCE(ap.total,0)
      ELSE COALESCE(c.carry,0) - COALESCE(ash.total,0) + COALESCE(ap.total,0)
    END as prev_balance,
    COALESCE(s.supply,0)  as period_supply,
    COALESCE(s.tax,0)     as period_tax,
    COALESCE(s.total,0)   as period_total,
    COALESCE(p.payment,0) as period_payment,
    (CASE WHEN (SELECT ref_date FROM ref) <= p_start_date
      THEN COALESCE(c.carry,0) + COALESCE(ash.total,0) - COALESCE(ap.total,0)
      ELSE COALESCE(c.carry,0) - COALESCE(ash.total,0) + COALESCE(ap.total,0)
    END) + COALESCE(s.total,0) - COALESCE(p.payment,0) as outstanding
  FROM active_clients ac
  LEFT JOIN carry    c   ON ac.client_code = c.client_code
  LEFT JOIN adj_ship ash ON ac.client_code = ash.client_code
  LEFT JOIN adj_pay  ap  ON ac.client_code = ap.client_code
  LEFT JOIN sales    s   ON ac.client_code = s.client_code
  LEFT JOIN pays     p   ON ac.client_code = p.client_code
  WHERE ((CASE WHEN (SELECT ref_date FROM ref) <= p_start_date
      THEN COALESCE(c.carry,0) + COALESCE(ash.total,0) - COALESCE(ap.total,0)
      ELSE COALESCE(c.carry,0) - COALESCE(ash.total,0) + COALESCE(ap.total,0)
    END) + COALESCE(s.total,0) - COALESCE(p.payment,0)) != 0
    OR COALESCE(s.total,0) != 0
    OR COALESCE(p.payment,0) != 0
)
SELECT COALESCE(jsonb_agg(row_to_json(final)::jsonb ORDER BY outstanding DESC), '[]'::jsonb) FROM final;
$function$;
