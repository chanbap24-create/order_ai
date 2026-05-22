-- calc_glass_outstanding_v2: 비활성화된 옛 코드 ((X) prefix) 제외
--
-- 사업자번호 변경 등으로 같은 이름의 새 코드가 생기면 옛 코드의
-- client_name 앞에 (X) prefix 를 붙여 비활성 표시. 이 함수는 그 비활성
-- 거래처를 결과에서 제외해 미수현황·검색 결과를 깔끔하게 유지.
--
-- - carryover 분기: client_name 에 (X) 시작 row 제외
-- - shipments 분기: client_name + glass_clients 마스터 양쪽 모두에 (X)
--   확인 (마스터가 (X) 면 출고 row 의 옛 client_name 이 (X) 가 아니어도 제외)

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
  FROM glass_client_carryover
  WHERE manager = p_manager
    AND (client_name IS NULL OR UPPER(client_name) NOT LIKE '(X)%')
  UNION
  SELECT gs.client_code, gs.client_name, 0::bigint as carry
  FROM (
    SELECT DISTINCT ON (client_code) client_code, client_name
    FROM glass_shipments
    WHERE manager = p_manager
      AND client_code IS NOT NULL
      AND client_name IS NOT NULL
      AND UPPER(client_name) NOT LIKE '(X)%'
    ORDER BY client_code, ship_date DESC
  ) gs
  WHERE NOT EXISTS (
    SELECT 1 FROM glass_client_carryover gcc
    WHERE gcc.client_code = gs.client_code AND gcc.manager = p_manager
  )
  AND NOT EXISTS (
    SELECT 1 FROM glass_clients gc
    WHERE gc.client_code = gs.client_code
      AND UPPER(gc.client_name) LIKE '(X)%'
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
