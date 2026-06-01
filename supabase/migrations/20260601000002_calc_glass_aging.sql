-- 대유라이프(글라스) 미수금 연령 분석 (달력 월 경과: 당월/1·2·3개월+) + 수금 상황.
-- calc_glass_outstanding_v2 와 동일한 거래처 기준. net_balance 는 outstanding 과 일치, 버킷 >= 0.
DROP FUNCTION IF EXISTS public.calc_glass_aging(text, date);
CREATE OR REPLACE FUNCTION public.calc_glass_aging(p_manager text, p_as_of date DEFAULT CURRENT_DATE)
RETURNS TABLE(
  client_code text, client_name text, net_balance bigint,
  b_cur bigint, b_m1 bigint, b_m2 bigint, b_m3 bigint,
  oldest_unpaid_date date, last_payment_date date,
  last_payment_amount bigint, paid_90d bigint
)
LANGUAGE sql STABLE SECURITY DEFINER AS $function$
WITH
ref AS (SELECT COALESCE(DATE_TRUNC('month', MIN(created_at))::date, DATE_TRUNC('month', CURRENT_DATE)::date) AS ref_date FROM glass_client_carryover),
cl AS (
  SELECT client_code, client_name, COALESCE(carryover_amount,0)::bigint AS carry FROM glass_client_carryover
  WHERE manager = p_manager AND (client_name IS NULL OR UPPER(client_name) NOT LIKE '(X)%')
  UNION
  SELECT gs.client_code, gs.client_name, 0::bigint FROM (
    SELECT DISTINCT ON (client_code) client_code, client_name FROM glass_shipments
    WHERE manager = p_manager AND client_code IS NOT NULL AND client_name IS NOT NULL AND UPPER(client_name) NOT LIKE '(X)%'
    ORDER BY client_code, ship_date DESC
  ) gs
  WHERE NOT EXISTS (SELECT 1 FROM glass_client_carryover gcc WHERE gcc.client_code = gs.client_code AND gcc.manager = p_manager)
    AND NOT EXISTS (SELECT 1 FROM glass_clients gc WHERE gc.client_code = gs.client_code AND UPPER(gc.client_name) LIKE '(X)%')
),
events AS (
  SELECT cl.client_code, (SELECT ref_date FROM ref) AS d, cl.carry AS amt FROM cl WHERE cl.carry <> 0
  UNION ALL
  SELECT gs.client_code, gs.ship_date::date, SUM(COALESCE(gs.total_amount,0))::bigint FROM glass_shipments gs
  WHERE gs.client_code IN (SELECT client_code FROM cl) AND gs.ship_date::date >= (SELECT ref_date FROM ref) AND gs.ship_date::date <= p_as_of
  GROUP BY gs.client_code, gs.ship_date::date HAVING SUM(COALESCE(gs.total_amount,0)) <> 0
),
pos AS (SELECT client_code, d, amt FROM events WHERE amt > 0),
credits AS (
  SELECT client_code, SUM(c)::bigint AS credits FROM (
    SELECT gp.client_code, COALESCE(gp.amount,0)::bigint AS c FROM glass_payments gp
    WHERE gp.client_code IN (SELECT client_code FROM cl) AND gp.payment_date::date >= (SELECT ref_date FROM ref) AND gp.payment_date::date <= p_as_of
    UNION ALL SELECT client_code, -amt FROM events WHERE amt < 0
  ) x GROUP BY client_code
),
total_pos AS (SELECT client_code, SUM(amt)::bigint AS tp FROM pos GROUP BY client_code),
ranked AS (SELECT p.client_code, p.d, p.amt, SUM(p.amt) OVER (PARTITION BY p.client_code ORDER BY p.d ROWS UNBOUNDED PRECEDING) AS cum_end FROM pos p),
unpaid AS (
  SELECT r.client_code, r.d, LEAST(r.amt, GREATEST(0, r.cum_end - COALESCE(cr.credits,0)))::bigint AS unpaid_amt,
    (EXTRACT(YEAR FROM p_as_of)::int*12 + EXTRACT(MONTH FROM p_as_of)::int)
      - (EXTRACT(YEAR FROM r.d)::int*12 + EXTRACT(MONTH FROM r.d)::int) AS mdiff
  FROM ranked r LEFT JOIN credits cr ON cr.client_code = r.client_code
),
lastpay AS (
  SELECT gp.client_code, MAX(gp.payment_date::date) AS last_payment_date,
    COALESCE(SUM(gp.amount) FILTER (WHERE gp.payment_date::date > p_as_of - 90),0)::bigint AS paid_90d
  FROM glass_payments gp WHERE gp.client_code IN (SELECT client_code FROM cl) AND gp.payment_date::date <= p_as_of GROUP BY gp.client_code
),
lastamt AS (
  SELECT DISTINCT ON (client_code) client_code, COALESCE(amount,0)::bigint AS last_payment_amount
  FROM glass_payments WHERE client_code IN (SELECT client_code FROM cl) AND payment_date::date <= p_as_of
  ORDER BY client_code, payment_date DESC, amount DESC
),
agg AS (
  SELECT u.client_code,
    COALESCE(SUM(u.unpaid_amt) FILTER (WHERE u.mdiff <= 0),0)::bigint AS b_cur,
    COALESCE(SUM(u.unpaid_amt) FILTER (WHERE u.mdiff = 1),0)::bigint  AS b_m1,
    COALESCE(SUM(u.unpaid_amt) FILTER (WHERE u.mdiff = 2),0)::bigint  AS b_m2,
    COALESCE(SUM(u.unpaid_amt) FILTER (WHERE u.mdiff >= 3),0)::bigint AS b_m3,
    MIN(u.d) FILTER (WHERE u.unpaid_amt > 0) AS oldest_unpaid_date
  FROM unpaid u GROUP BY u.client_code
)
SELECT cl.client_code, MAX(cl.client_name) AS client_name, (COALESCE(MAX(tp.tp),0) - COALESCE(MAX(cr.credits),0))::bigint AS net_balance,
  COALESCE(MAX(a.b_cur),0), COALESCE(MAX(a.b_m1),0), COALESCE(MAX(a.b_m2),0), COALESCE(MAX(a.b_m3),0),
  MAX(a.oldest_unpaid_date), MAX(lp.last_payment_date), COALESCE(MAX(la.last_payment_amount),0), COALESCE(MAX(lp.paid_90d),0)
FROM cl
LEFT JOIN total_pos tp ON tp.client_code = cl.client_code
LEFT JOIN credits cr ON cr.client_code = cl.client_code
LEFT JOIN agg a ON a.client_code = cl.client_code
LEFT JOIN lastpay lp ON lp.client_code = cl.client_code
LEFT JOIN lastamt la ON la.client_code = cl.client_code
GROUP BY cl.client_code
HAVING (COALESCE(MAX(tp.tp),0) - COALESCE(MAX(cr.credits),0)) <> 0
    OR COALESCE(MAX(a.b_cur),0)+COALESCE(MAX(a.b_m1),0)+COALESCE(MAX(a.b_m2),0)+COALESCE(MAX(a.b_m3),0) <> 0
ORDER BY COALESCE(MAX(a.b_m3),0) DESC, net_balance DESC;
$function$;
