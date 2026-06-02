-- 수금/미수 RPC 최종 스냅샷 (재현성 보장).
-- 2026-06-01~02 사이 일부 RPC 수정을 Supabase apply_migration 으로 적용했으나
-- 레포 마이그레이션 파일이 '참고 주석'만 있어, 레포에서 재실행 시 수정이 누락됨.
-- 이 파일은 라이브 DB의 최종 정의를 박제(CREATE OR REPLACE 멱등)하여 재실행을 정상화한다.
-- 규칙: 글라스·와인 미수 = 이월 + (2025-08-01 이후 출고) - (2025-08-01 이후 수금).

-- ① calc_glass_aging
CREATE OR REPLACE FUNCTION public.calc_glass_aging(p_manager text, p_as_of date DEFAULT CURRENT_DATE)
 RETURNS TABLE(client_code text, client_name text, net_balance bigint, b_cur bigint, b_m1 bigint, b_m2 bigint, b_m3 bigint, oldest_unpaid_date date, last_payment_date date, last_payment_amount bigint, paid_90d bigint, overdue bigint)
 LANGUAGE sql STABLE SECURITY DEFINER
AS $function$
WITH
ref AS (SELECT DATE '2025-08-01' AS ref_date),
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
terms AS (SELECT client_code, payment_type FROM collection_followups WHERE client_type = 'glass'),
ranked AS (SELECT p.client_code, p.d, p.amt, SUM(p.amt) OVER (PARTITION BY p.client_code ORDER BY p.d ROWS UNBOUNDED PRECEDING) AS cum_end FROM pos p),
unpaid AS (
  SELECT r.client_code, r.d, LEAST(r.amt, GREATEST(0, r.cum_end - COALESCE(cr.credits,0)))::bigint AS unpaid_amt,
    (EXTRACT(YEAR FROM p_as_of)::int*12 + EXTRACT(MONTH FROM p_as_of)::int) - (EXTRACT(YEAR FROM r.d)::int*12 + EXTRACT(MONTH FROM r.d)::int) AS mdiff,
    fn_due_date(t.payment_type, r.d) AS due_date
  FROM ranked r LEFT JOIN credits cr ON cr.client_code = r.client_code LEFT JOIN terms t ON t.client_code = r.client_code
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
    COALESCE(SUM(u.unpaid_amt) FILTER (WHERE u.due_date IS NOT NULL AND u.due_date < p_as_of),0)::bigint AS overdue,
    MIN(u.d) FILTER (WHERE u.unpaid_amt > 0) AS oldest_unpaid_date
  FROM unpaid u GROUP BY u.client_code
)
SELECT cl.client_code, MAX(cl.client_name) AS client_name, (COALESCE(MAX(tp.tp),0) - COALESCE(MAX(cr.credits),0))::bigint AS net_balance,
  COALESCE(MAX(a.b_cur),0), COALESCE(MAX(a.b_m1),0), COALESCE(MAX(a.b_m2),0), COALESCE(MAX(a.b_m3),0),
  MAX(a.oldest_unpaid_date), MAX(lp.last_payment_date), COALESCE(MAX(la.last_payment_amount),0), COALESCE(MAX(lp.paid_90d),0),
  COALESCE(MAX(a.overdue),0)
FROM cl
LEFT JOIN total_pos tp ON tp.client_code = cl.client_code
LEFT JOIN credits cr ON cr.client_code = cl.client_code
LEFT JOIN agg a ON a.client_code = cl.client_code
LEFT JOIN lastpay lp ON lp.client_code = cl.client_code
LEFT JOIN lastamt la ON la.client_code = cl.client_code
GROUP BY cl.client_code
HAVING (COALESCE(MAX(tp.tp),0) - COALESCE(MAX(cr.credits),0)) <> 0
    OR COALESCE(MAX(a.b_cur),0)+COALESCE(MAX(a.b_m1),0)+COALESCE(MAX(a.b_m2),0)+COALESCE(MAX(a.b_m3),0) <> 0
ORDER BY COALESCE(MAX(a.overdue),0) DESC, net_balance DESC;
$function$;

-- ② calc_glass_outstanding_v2
CREATE OR REPLACE FUNCTION public.calc_glass_outstanding_v2(p_manager text, p_start_date text, p_end_date text)
 RETURNS jsonb LANGUAGE sql SECURITY DEFINER
AS $function$
WITH
ref AS (SELECT '2025-08-01' as ref_date),
client_list AS (
  SELECT client_code, client_name, COALESCE(carryover_amount, 0)::bigint as carry
  FROM glass_client_carryover
  WHERE manager = p_manager AND (client_name IS NULL OR UPPER(client_name) NOT LIKE '(X)%')
  UNION
  SELECT gs.client_code, gs.client_name, 0::bigint as carry
  FROM (
    SELECT DISTINCT ON (client_code) client_code, client_name FROM glass_shipments
    WHERE manager = p_manager AND client_code IS NOT NULL AND client_name IS NOT NULL AND UPPER(client_name) NOT LIKE '(X)%'
    ORDER BY client_code, ship_date DESC
  ) gs
  WHERE NOT EXISTS (SELECT 1 FROM glass_client_carryover gcc WHERE gcc.client_code = gs.client_code AND gcc.manager = p_manager)
  AND NOT EXISTS (SELECT 1 FROM glass_clients gc WHERE gc.client_code = gs.client_code AND UPPER(gc.client_name) LIKE '(X)%')
),
adj_ship AS (
  SELECT gs.client_code, SUM(COALESCE(gs.total_amount,0))::bigint as total FROM glass_shipments gs
  WHERE gs.client_code IN (SELECT client_code FROM client_list)
    AND gs.ship_date::date >= LEAST((SELECT ref_date FROM ref)::date, p_start_date::date)
    AND gs.ship_date::date <  GREATEST((SELECT ref_date FROM ref)::date, p_start_date::date)
  GROUP BY gs.client_code
),
adj_pay AS (
  SELECT gp.client_code, SUM(COALESCE(gp.amount,0))::bigint as total FROM glass_payments gp
  WHERE gp.client_code IN (SELECT client_code FROM client_list)
    AND gp.payment_date::date >= LEAST((SELECT ref_date FROM ref)::date, p_start_date::date)
    AND gp.payment_date::date <  GREATEST((SELECT ref_date FROM ref)::date, p_start_date::date)
  GROUP BY gp.client_code
),
sales AS (
  SELECT gs.client_code, SUM(COALESCE(gs.supply_amount,0))::bigint as supply, SUM(COALESCE(gs.tax_amount,0))::bigint as tax, SUM(COALESCE(gs.total_amount,0))::bigint as total
  FROM glass_shipments gs
  WHERE gs.client_code IN (SELECT client_code FROM client_list) AND gs.ship_date::date >= p_start_date::date AND gs.ship_date::date <= p_end_date::date
  GROUP BY gs.client_code
),
pays AS (
  SELECT gp.client_code, SUM(COALESCE(gp.amount,0))::bigint as payment FROM glass_payments gp
  WHERE gp.client_code IN (SELECT client_code FROM client_list) AND gp.payment_date::date >= p_start_date::date AND gp.payment_date::date <= p_end_date::date
  GROUP BY gp.client_code
),
final AS (
  SELECT cl.client_code, cl.client_name,
    CASE WHEN (SELECT ref_date FROM ref) <= p_start_date THEN cl.carry + COALESCE(ash.total,0) - COALESCE(ap.total,0) ELSE cl.carry - COALESCE(ash.total,0) + COALESCE(ap.total,0) END as prev_balance,
    COALESCE(s.supply,0) as period_supply, COALESCE(s.tax,0) as period_tax, COALESCE(s.total,0) as period_total, COALESCE(p.payment,0) as period_payment,
    (CASE WHEN (SELECT ref_date FROM ref) <= p_start_date THEN cl.carry + COALESCE(ash.total,0) - COALESCE(ap.total,0) ELSE cl.carry - COALESCE(ash.total,0) + COALESCE(ap.total,0) END) + COALESCE(s.total,0) - COALESCE(p.payment,0) as outstanding
  FROM client_list cl
  LEFT JOIN adj_ship ash ON cl.client_code = ash.client_code
  LEFT JOIN adj_pay  ap  ON cl.client_code = ap.client_code
  LEFT JOIN sales    s   ON cl.client_code = s.client_code
  LEFT JOIN pays     p   ON cl.client_code = p.client_code
  WHERE ((CASE WHEN (SELECT ref_date FROM ref) <= p_start_date THEN cl.carry + COALESCE(ash.total,0) - COALESCE(ap.total,0) ELSE cl.carry - COALESCE(ash.total,0) + COALESCE(ap.total,0) END) + COALESCE(s.total,0) - COALESCE(p.payment,0)) != 0
    OR COALESCE(s.total,0) != 0 OR COALESCE(p.payment,0) != 0
)
SELECT COALESCE(jsonb_agg(row_to_json(final)::jsonb ORDER BY outstanding DESC), '[]'::jsonb) FROM final;
$function$;

-- ③ calc_wine_aging
CREATE OR REPLACE FUNCTION public.calc_wine_aging(p_manager text, p_as_of date DEFAULT CURRENT_DATE)
 RETURNS TABLE(client_code text, client_name text, net_balance bigint, b_cur bigint, b_m1 bigint, b_m2 bigint, b_m3 bigint, oldest_unpaid_date date, last_payment_date date, last_payment_amount bigint, paid_90d bigint, overdue bigint)
 LANGUAGE sql STABLE SECURITY DEFINER
AS $function$
WITH
ref AS (SELECT DATE '2025-08-01' AS ref_date),
ac AS (
  SELECT client_code, COALESCE(client_name, client_code) AS client_name FROM client_details
  WHERE manager = p_manager AND client_type = 'wine'
    AND (client_name IS NULL OR UPPER(client_name) NOT LIKE '(X)%') AND client_code <> COALESCE(client_name, '')
),
events AS (
  SELECT ac.client_code, (SELECT ref_date FROM ref) AS d, SUM(COALESCE(cc.carryover_amount,0))::bigint AS amt
  FROM ac JOIN client_carryover cc ON cc.client_code = ac.client_code GROUP BY ac.client_code HAVING SUM(COALESCE(cc.carryover_amount,0)) <> 0
  UNION ALL
  SELECT s.client_code, s.ship_date::date, SUM(COALESCE(s.total_amount,0))::bigint FROM shipments s
  WHERE s.client_code IN (SELECT client_code FROM ac) AND s.ship_date::date >= (SELECT ref_date FROM ref) AND s.ship_date::date <= p_as_of
  GROUP BY s.client_code, s.ship_date::date HAVING SUM(COALESCE(s.total_amount,0)) <> 0
),
pos AS (SELECT client_code, d, amt FROM events WHERE amt > 0),
credits AS (
  SELECT client_code, SUM(c)::bigint AS credits FROM (
    SELECT p.client_code, COALESCE(p.amount,0) AS c FROM payments p
    WHERE p.client_code IN (SELECT client_code FROM ac) AND p.payment_date::date >= (SELECT ref_date FROM ref) AND p.payment_date::date <= p_as_of
    UNION ALL SELECT client_code, -amt FROM events WHERE amt < 0
  ) x GROUP BY client_code
),
total_pos AS (SELECT client_code, SUM(amt)::bigint AS tp FROM pos GROUP BY client_code),
terms AS (SELECT client_code, payment_type FROM collection_followups WHERE client_type = 'wine'),
ranked AS (SELECT p.client_code, p.d, p.amt, SUM(p.amt) OVER (PARTITION BY p.client_code ORDER BY p.d ROWS UNBOUNDED PRECEDING) AS cum_end FROM pos p),
unpaid AS (
  SELECT r.client_code, r.d, LEAST(r.amt, GREATEST(0, r.cum_end - COALESCE(cr.credits,0)))::bigint AS unpaid_amt,
    (EXTRACT(YEAR FROM p_as_of)::int*12 + EXTRACT(MONTH FROM p_as_of)::int) - (EXTRACT(YEAR FROM r.d)::int*12 + EXTRACT(MONTH FROM r.d)::int) AS mdiff,
    fn_due_date(t.payment_type, r.d) AS due_date
  FROM ranked r LEFT JOIN credits cr ON cr.client_code = r.client_code LEFT JOIN terms t ON t.client_code = r.client_code
),
lastpay AS (
  SELECT p.client_code, MAX(p.payment_date::date) AS last_payment_date,
    COALESCE(SUM(p.amount) FILTER (WHERE p.payment_date::date > p_as_of - 90),0)::bigint AS paid_90d
  FROM payments p WHERE p.client_code IN (SELECT client_code FROM ac) AND p.payment_date::date <= p_as_of GROUP BY p.client_code
),
lastamt AS (
  SELECT DISTINCT ON (client_code) client_code, COALESCE(amount,0)::bigint AS last_payment_amount
  FROM payments WHERE client_code IN (SELECT client_code FROM ac) AND payment_date::date <= p_as_of
  ORDER BY client_code, payment_date DESC, amount DESC
),
agg AS (
  SELECT u.client_code,
    COALESCE(SUM(u.unpaid_amt) FILTER (WHERE u.mdiff <= 0),0)::bigint AS b_cur,
    COALESCE(SUM(u.unpaid_amt) FILTER (WHERE u.mdiff = 1),0)::bigint  AS b_m1,
    COALESCE(SUM(u.unpaid_amt) FILTER (WHERE u.mdiff = 2),0)::bigint  AS b_m2,
    COALESCE(SUM(u.unpaid_amt) FILTER (WHERE u.mdiff >= 3),0)::bigint AS b_m3,
    COALESCE(SUM(u.unpaid_amt) FILTER (WHERE u.due_date IS NOT NULL AND u.due_date < p_as_of),0)::bigint AS overdue,
    MIN(u.d) FILTER (WHERE u.unpaid_amt > 0) AS oldest_unpaid_date
  FROM unpaid u GROUP BY u.client_code
)
SELECT ac.client_code, ac.client_name, (COALESCE(tp.tp,0) - COALESCE(cr.credits,0))::bigint AS net_balance,
  COALESCE(a.b_cur,0), COALESCE(a.b_m1,0), COALESCE(a.b_m2,0), COALESCE(a.b_m3,0),
  a.oldest_unpaid_date, lp.last_payment_date, COALESCE(la.last_payment_amount,0), COALESCE(lp.paid_90d,0),
  COALESCE(a.overdue,0)
FROM ac
LEFT JOIN total_pos tp ON tp.client_code = ac.client_code
LEFT JOIN credits cr ON cr.client_code = ac.client_code
LEFT JOIN agg a ON a.client_code = ac.client_code
LEFT JOIN lastpay lp ON lp.client_code = ac.client_code
LEFT JOIN lastamt la ON la.client_code = ac.client_code
WHERE (COALESCE(tp.tp,0) - COALESCE(cr.credits,0)) <> 0
   OR COALESCE(a.b_cur,0)+COALESCE(a.b_m1,0)+COALESCE(a.b_m2,0)+COALESCE(a.b_m3,0) <> 0
ORDER BY COALESCE(a.overdue,0) DESC, net_balance DESC;
$function$;

-- ④ calc_wine_outstanding
CREATE OR REPLACE FUNCTION public.calc_wine_outstanding(p_manager text, p_start_date text, p_end_date text)
 RETURNS jsonb LANGUAGE sql SECURITY DEFINER
AS $function$
WITH
ref AS (SELECT '2025-08-01' as ref_date),
active_clients AS (
  SELECT client_code, COALESCE(client_name, client_code) as client_name FROM client_details
  WHERE manager = p_manager AND (client_name IS NULL OR (UPPER(client_name) NOT LIKE '(X)%')) AND client_code != COALESCE(client_name, '')
),
carry AS (
  SELECT ac.client_code, SUM(COALESCE(cc.carryover_amount, 0))::bigint as carry
  FROM active_clients ac LEFT JOIN client_carryover cc ON cc.client_code = ac.client_code GROUP BY ac.client_code
),
adj_ship AS (
  SELECT s.client_code, SUM(COALESCE(s.total_amount, 0))::bigint as total FROM shipments s
  WHERE s.client_code IN (SELECT client_code FROM active_clients)
    AND s.ship_date::date >= LEAST((SELECT ref_date FROM ref)::date, p_start_date::date)
    AND s.ship_date::date <  GREATEST((SELECT ref_date FROM ref)::date, p_start_date::date)
  GROUP BY s.client_code
),
adj_pay AS (
  SELECT p.client_code, SUM(COALESCE(p.amount, 0))::bigint as total FROM payments p
  WHERE p.client_code IN (SELECT client_code FROM active_clients)
    AND p.payment_date::date >= LEAST((SELECT ref_date FROM ref)::date, p_start_date::date)
    AND p.payment_date::date <  GREATEST((SELECT ref_date FROM ref)::date, p_start_date::date)
  GROUP BY p.client_code
),
sales AS (
  SELECT s.client_code, SUM(COALESCE(s.supply_amount, 0))::bigint as supply, SUM(COALESCE(s.tax_amount, 0))::bigint as tax, SUM(COALESCE(s.total_amount, 0))::bigint as total
  FROM shipments s WHERE s.client_code IN (SELECT client_code FROM active_clients) AND s.ship_date::date >= p_start_date::date AND s.ship_date::date <= p_end_date::date
  GROUP BY s.client_code
),
pays AS (
  SELECT p.client_code, SUM(COALESCE(p.amount, 0))::bigint as payment FROM payments p
  WHERE p.client_code IN (SELECT client_code FROM active_clients) AND p.payment_date::date >= p_start_date::date AND p.payment_date::date <= p_end_date::date
  GROUP BY p.client_code
),
final AS (
  SELECT ac.client_code, ac.client_name,
    CASE WHEN (SELECT ref_date FROM ref) <= p_start_date THEN COALESCE(c.carry,0) + COALESCE(ash.total,0) - COALESCE(ap.total,0) ELSE COALESCE(c.carry,0) - COALESCE(ash.total,0) + COALESCE(ap.total,0) END as prev_balance,
    COALESCE(s.supply,0) as period_supply, COALESCE(s.tax,0) as period_tax, COALESCE(s.total,0) as period_total, COALESCE(p.payment,0) as period_payment,
    (CASE WHEN (SELECT ref_date FROM ref) <= p_start_date THEN COALESCE(c.carry,0) + COALESCE(ash.total,0) - COALESCE(ap.total,0) ELSE COALESCE(c.carry,0) - COALESCE(ash.total,0) + COALESCE(ap.total,0) END) + COALESCE(s.total,0) - COALESCE(p.payment,0) as outstanding
  FROM active_clients ac
  LEFT JOIN carry c ON ac.client_code = c.client_code
  LEFT JOIN adj_ship ash ON ac.client_code = ash.client_code
  LEFT JOIN adj_pay ap ON ac.client_code = ap.client_code
  LEFT JOIN sales s ON ac.client_code = s.client_code
  LEFT JOIN pays p ON ac.client_code = p.client_code
  WHERE ((CASE WHEN (SELECT ref_date FROM ref) <= p_start_date THEN COALESCE(c.carry,0) + COALESCE(ash.total,0) - COALESCE(ap.total,0) ELSE COALESCE(c.carry,0) - COALESCE(ash.total,0) + COALESCE(ap.total,0) END) + COALESCE(s.total,0) - COALESCE(p.payment,0)) != 0
    OR COALESCE(s.total,0) != 0 OR COALESCE(p.payment,0) != 0
)
SELECT COALESCE(jsonb_agg(row_to_json(final)::jsonb ORDER BY outstanding DESC), '[]'::jsonb) FROM final;
$function$;

-- ⑤ fn_client_balance_at (glass+wine, 2025-08-01 cutoff)
CREATE OR REPLACE FUNCTION public.fn_client_balance_at(p_code text, p_type text, p_date date)
 RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER
AS $function$
  SELECT (CASE WHEN p_type='glass' THEN
    (SELECT COALESCE(SUM(carryover_amount),0) FROM glass_client_carryover WHERE client_code=p_code)
    + (SELECT COALESCE(SUM(total_amount),0) FROM glass_shipments WHERE client_code=p_code AND ship_date::date>=DATE '2025-08-01' AND ship_date::date<=p_date)
    - (SELECT COALESCE(SUM(amount),0) FROM glass_payments WHERE client_code=p_code AND payment_date::date>=DATE '2025-08-01' AND payment_date::date<=p_date)
  ELSE
    (SELECT COALESCE(SUM(carryover_amount),0) FROM client_carryover WHERE client_code=p_code)
    + (SELECT COALESCE(SUM(total_amount),0) FROM shipments WHERE client_code=p_code AND ship_date::date>=DATE '2025-08-01' AND ship_date::date<=p_date)
    - (SELECT COALESCE(SUM(amount),0) FROM payments WHERE client_code=p_code AND payment_date::date>=DATE '2025-08-01' AND payment_date::date<=p_date)
  END)::bigint;
$function$;

-- ⑥ fn_client_due_amount_at (지정일까지 만기도래 연체액, 없으면 전체 미수)
CREATE OR REPLACE FUNCTION public.fn_client_due_amount_at(p_code text, p_type text, p_date date)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER AS $function$
WITH
pt AS (SELECT payment_type AS v FROM collection_followups WHERE client_code=p_code AND client_type=p_type LIMIT 1),
carry AS (
  SELECT (CASE WHEN p_type='glass'
    THEN (SELECT COALESCE(SUM(carryover_amount),0) FROM glass_client_carryover WHERE client_code=p_code)
    ELSE (SELECT COALESCE(SUM(carryover_amount),0) FROM client_carryover WHERE client_code=p_code) END)::bigint AS amt
),
ship_days AS (
  SELECT d, SUM(amt)::bigint AS amt FROM (
    SELECT ship_date::date AS d, COALESCE(total_amount,0) AS amt FROM glass_shipments
      WHERE p_type='glass' AND client_code=p_code AND ship_date::date BETWEEN DATE '2025-08-01' AND p_date
    UNION ALL
    SELECT ship_date::date, COALESCE(total_amount,0) FROM shipments
      WHERE p_type<>'glass' AND client_code=p_code AND ship_date::date BETWEEN DATE '2025-08-01' AND p_date
  ) z GROUP BY d HAVING SUM(amt) <> 0
),
pmt AS (
  SELECT COALESCE(SUM(amt),0)::bigint AS v FROM (
    SELECT COALESCE(amount,0) AS amt FROM glass_payments WHERE p_type='glass' AND client_code=p_code AND payment_date::date BETWEEN DATE '2025-08-01' AND p_date
    UNION ALL
    SELECT COALESCE(amount,0) FROM payments WHERE p_type<>'glass' AND client_code=p_code AND payment_date::date BETWEEN DATE '2025-08-01' AND p_date
  ) z
),
agg AS (
  SELECT (SELECT amt FROM carry) AS carry,
    COALESCE((SELECT SUM(amt) FROM ship_days),0)::bigint AS ship_sum,
    COALESCE((SELECT SUM(-amt) FROM ship_days WHERE amt<0),0)::bigint AS neg_sum,
    (SELECT v FROM pmt) AS pmt
),
credits AS (SELECT (pmt + neg_sum)::bigint AS c FROM agg),
events AS (
  SELECT DATE '2025-08-01' AS d, (SELECT carry FROM agg) AS amt WHERE (SELECT carry FROM agg) > 0
  UNION ALL SELECT d, amt FROM ship_days WHERE amt > 0
),
ranked AS (SELECT d, amt, SUM(amt) OVER (ORDER BY d ROWS UNBOUNDED PRECEDING) AS cum_end FROM events),
unpaid AS (
  SELECT LEAST(amt, GREATEST(0, cum_end - (SELECT c FROM credits)))::bigint AS u,
    fn_due_date((SELECT v FROM pt), d) AS due FROM ranked
),
res AS (
  SELECT COALESCE(SUM(u) FILTER (WHERE due IS NOT NULL AND due <= p_date),0)::bigint AS overdue,
    ((SELECT carry FROM agg) + (SELECT ship_sum FROM agg) - (SELECT pmt FROM agg))::bigint AS bal
  FROM unpaid
)
SELECT CASE WHEN overdue > 0 THEN overdue ELSE bal END FROM res;
$function$;

-- ⑦ fn_collection_schedule (glass+wine 2025-08-01 cutoff)
CREATE OR REPLACE FUNCTION public.fn_collection_schedule(p_manager text, p_type text, p_as_of date DEFAULT CURRENT_DATE)
 RETURNS TABLE(client_code text, client_name text, business_type text, net_now bigint, net_close bigint, period_supply bigint, period_tax bigint, period_total bigint, period_payment bigint, payment_type text, manual_amount boolean, close_date date)
 LANGUAGE sql STABLE SECURITY DEFINER
AS $function$
  WITH cd_close AS (
    SELECT (CASE WHEN EXTRACT(DAY FROM p_as_of) >= 21 THEN date_trunc('month', p_as_of)::date + 19 ELSE date_trunc('month', p_as_of)::date - 1 END) AS d
  ),
  clients AS (
    SELECT cd.client_code, COALESCE(cd.client_name, cd.client_code) AS client_name, cd.business_type
    FROM client_details cd
    WHERE p_type = 'wine' AND cd.manager = p_manager AND cd.client_type = 'wine'
      AND (cd.client_name IS NULL OR UPPER(cd.client_name) NOT LIKE '(X)%') AND cd.client_code <> COALESCE(cd.client_name, '')
    UNION
    SELECT g.client_code, g.client_name, NULL::text
    FROM (SELECT DISTINCT ON (client_code) client_code, client_name, manager FROM glass_shipments
          WHERE p_type = 'glass' AND manager IS NOT NULL AND client_name IS NOT NULL AND UPPER(client_name) NOT LIKE '(X)%'
          ORDER BY client_code, ship_date DESC) g
    WHERE g.manager = p_manager
    UNION
    SELECT gco.client_code, gco.client_name, NULL::text FROM glass_client_carryover gco
    WHERE p_type = 'glass' AND gco.manager = p_manager AND (gco.client_name IS NULL OR UPPER(gco.client_name) NOT LIKE '(X)%')
  ),
  dedup AS (SELECT client_code, MAX(client_name) AS client_name, MAX(business_type) AS business_type FROM clients GROUP BY client_code),
  calc AS (
    SELECT c.client_code, c.client_name, c.business_type,
      (CASE WHEN p_type='glass' THEN
        (SELECT COALESCE(SUM(carryover_amount),0) FROM glass_client_carryover WHERE client_code=c.client_code)
        + (SELECT COALESCE(SUM(total_amount),0) FROM glass_shipments WHERE client_code=c.client_code AND ship_date::date>=DATE '2025-08-01' AND ship_date::date<=p_as_of)
        - (SELECT COALESCE(SUM(amount),0) FROM glass_payments WHERE client_code=c.client_code AND payment_date::date>=DATE '2025-08-01' AND payment_date::date<=p_as_of)
      ELSE
        (SELECT COALESCE(SUM(carryover_amount),0) FROM client_carryover WHERE client_code=c.client_code)
        + (SELECT COALESCE(SUM(total_amount),0) FROM shipments WHERE client_code=c.client_code AND ship_date::date>=DATE '2025-08-01' AND ship_date::date<=p_as_of)
        - (SELECT COALESCE(SUM(amount),0) FROM payments WHERE client_code=c.client_code AND payment_date::date>=DATE '2025-08-01' AND payment_date::date<=p_as_of)
      END)::bigint AS net_now,
      (CASE WHEN p_type='glass' THEN
        (SELECT COALESCE(SUM(carryover_amount),0) FROM glass_client_carryover WHERE client_code=c.client_code)
        + (SELECT COALESCE(SUM(total_amount),0) FROM glass_shipments WHERE client_code=c.client_code AND ship_date::date>=DATE '2025-08-01' AND ship_date::date<=(SELECT d FROM cd_close))
        - (SELECT COALESCE(SUM(amount),0) FROM glass_payments WHERE client_code=c.client_code AND payment_date::date>=DATE '2025-08-01' AND payment_date::date<=(SELECT d FROM cd_close))
      ELSE
        (SELECT COALESCE(SUM(carryover_amount),0) FROM client_carryover WHERE client_code=c.client_code)
        + (SELECT COALESCE(SUM(total_amount),0) FROM shipments WHERE client_code=c.client_code AND ship_date::date>=DATE '2025-08-01' AND ship_date::date<=(SELECT d FROM cd_close))
        - (SELECT COALESCE(SUM(amount),0) FROM payments WHERE client_code=c.client_code AND payment_date::date>=DATE '2025-08-01' AND payment_date::date<=(SELECT d FROM cd_close))
      END)::bigint AS net_close,
      (CASE WHEN p_type='glass' THEN (SELECT COALESCE(SUM(supply_amount),0) FROM glass_shipments WHERE client_code=c.client_code AND ship_date::date>(SELECT d FROM cd_close) AND ship_date::date<=p_as_of)
        ELSE (SELECT COALESCE(SUM(supply_amount),0) FROM shipments WHERE client_code=c.client_code AND ship_date::date>(SELECT d FROM cd_close) AND ship_date::date<=p_as_of) END)::bigint AS period_supply,
      (CASE WHEN p_type='glass' THEN (SELECT COALESCE(SUM(tax_amount),0) FROM glass_shipments WHERE client_code=c.client_code AND ship_date::date>(SELECT d FROM cd_close) AND ship_date::date<=p_as_of)
        ELSE (SELECT COALESCE(SUM(tax_amount),0) FROM shipments WHERE client_code=c.client_code AND ship_date::date>(SELECT d FROM cd_close) AND ship_date::date<=p_as_of) END)::bigint AS period_tax,
      (CASE WHEN p_type='glass' THEN (SELECT COALESCE(SUM(total_amount),0) FROM glass_shipments WHERE client_code=c.client_code AND ship_date::date>(SELECT d FROM cd_close) AND ship_date::date<=p_as_of)
        ELSE (SELECT COALESCE(SUM(total_amount),0) FROM shipments WHERE client_code=c.client_code AND ship_date::date>(SELECT d FROM cd_close) AND ship_date::date<=p_as_of) END)::bigint AS period_total,
      (CASE WHEN p_type='glass' THEN (SELECT COALESCE(SUM(amount),0) FROM glass_payments WHERE client_code=c.client_code AND payment_date::date>(SELECT d FROM cd_close) AND payment_date::date<=p_as_of)
        ELSE (SELECT COALESCE(SUM(amount),0) FROM payments WHERE client_code=c.client_code AND payment_date::date>(SELECT d FROM cd_close) AND payment_date::date<=p_as_of) END)::bigint AS period_payment
    FROM dedup c
  )
  SELECT calc.client_code, calc.client_name, calc.business_type, calc.net_now, calc.net_close, calc.period_supply, calc.period_tax, calc.period_total, calc.period_payment,
    f.payment_type, COALESCE(f.manual_amount,false), (SELECT d FROM cd_close)
  FROM calc LEFT JOIN collection_followups f ON f.client_code=calc.client_code AND f.client_type=p_type
  WHERE calc.net_now <> 0 ORDER BY calc.net_now DESC;
$function$;
