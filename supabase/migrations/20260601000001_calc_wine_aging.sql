-- 까브드뱅(와인) 미수금 연령 분석.
-- 기존 calc_wine_outstanding 과 동일한 거래처/이월(ref_date) 기준 위에서,
-- 채무(이월@ref_date + 출고 total_amount)와 credit(수금 + 반품/선수금 등 음수)을
-- FIFO 로 매칭해 남은 미수를 0-30 / 31-60 / 61-90 / 90+ 일 버킷으로 분류한다.
-- net_balance = calc_wine_outstanding 의 outstanding 과 일치(원 단위). 버킷은 항상 >= 0.
DROP FUNCTION IF EXISTS public.calc_wine_aging(text, date);
CREATE OR REPLACE FUNCTION public.calc_wine_aging(p_manager text, p_as_of date DEFAULT CURRENT_DATE)
RETURNS TABLE(
  client_code text, client_name text,
  net_balance bigint,
  b_0_30 bigint, b_31_60 bigint, b_61_90 bigint, b_90plus bigint,
  oldest_unpaid_date date, last_payment_date date
)
LANGUAGE sql STABLE SECURITY DEFINER AS $function$
WITH
ref AS (
  SELECT COALESCE(DATE_TRUNC('month', MIN(created_at))::date, DATE_TRUNC('month', CURRENT_DATE)::date) AS ref_date
  FROM client_carryover
),
ac AS (
  SELECT client_code, COALESCE(client_name, client_code) AS client_name
  FROM client_details
  WHERE manager = p_manager AND client_type = 'wine'
    AND (client_name IS NULL OR UPPER(client_name) NOT LIKE '(X)%')
    AND client_code <> COALESCE(client_name, '')
),
events AS (
  SELECT ac.client_code, (SELECT ref_date FROM ref) AS d, SUM(COALESCE(cc.carryover_amount,0))::bigint AS amt
  FROM ac JOIN client_carryover cc ON cc.client_code = ac.client_code
  GROUP BY ac.client_code
  HAVING SUM(COALESCE(cc.carryover_amount,0)) <> 0
  UNION ALL
  SELECT s.client_code, s.ship_date::date, SUM(COALESCE(s.total_amount,0))::bigint
  FROM shipments s
  WHERE s.client_code IN (SELECT client_code FROM ac)
    AND s.ship_date::date >= (SELECT ref_date FROM ref) AND s.ship_date::date <= p_as_of
  GROUP BY s.client_code, s.ship_date::date
  HAVING SUM(COALESCE(s.total_amount,0)) <> 0
),
pos AS (SELECT client_code, d, amt FROM events WHERE amt > 0),
credits AS (
  SELECT client_code, SUM(c)::bigint AS credits FROM (
    SELECT p.client_code, COALESCE(p.amount,0) AS c
    FROM payments p
    WHERE p.client_code IN (SELECT client_code FROM ac)
      AND p.payment_date::date >= (SELECT ref_date FROM ref) AND p.payment_date::date <= p_as_of
    UNION ALL
    SELECT client_code, -amt FROM events WHERE amt < 0
  ) x GROUP BY client_code
),
total_pos AS (SELECT client_code, SUM(amt)::bigint AS tp FROM pos GROUP BY client_code),
ranked AS (
  SELECT p.client_code, p.d, p.amt,
    SUM(p.amt) OVER (PARTITION BY p.client_code ORDER BY p.d ROWS UNBOUNDED PRECEDING) AS cum_end
  FROM pos p
),
unpaid AS (
  SELECT r.client_code, r.d,
    LEAST(r.amt, GREATEST(0, r.cum_end - COALESCE(cr.credits,0)))::bigint AS unpaid_amt
  FROM ranked r LEFT JOIN credits cr ON cr.client_code = r.client_code
),
lastpay AS (
  SELECT p.client_code, MAX(p.payment_date::date) AS last_payment_date
  FROM payments p WHERE p.client_code IN (SELECT client_code FROM ac) AND p.payment_date::date <= p_as_of
  GROUP BY p.client_code
),
agg AS (
  SELECT u.client_code,
    COALESCE(SUM(u.unpaid_amt) FILTER (WHERE p_as_of - u.d <= 30),0)::bigint            AS b_0_30,
    COALESCE(SUM(u.unpaid_amt) FILTER (WHERE p_as_of - u.d BETWEEN 31 AND 60),0)::bigint  AS b_31_60,
    COALESCE(SUM(u.unpaid_amt) FILTER (WHERE p_as_of - u.d BETWEEN 61 AND 90),0)::bigint  AS b_61_90,
    COALESCE(SUM(u.unpaid_amt) FILTER (WHERE p_as_of - u.d > 90),0)::bigint               AS b_90plus,
    MIN(u.d) FILTER (WHERE u.unpaid_amt > 0) AS oldest_unpaid_date
  FROM unpaid u GROUP BY u.client_code
)
SELECT ac.client_code, ac.client_name,
  (COALESCE(tp.tp,0) - COALESCE(cr.credits,0))::bigint AS net_balance,
  COALESCE(a.b_0_30,0), COALESCE(a.b_31_60,0), COALESCE(a.b_61_90,0), COALESCE(a.b_90plus,0),
  a.oldest_unpaid_date, lp.last_payment_date
FROM ac
LEFT JOIN total_pos tp ON tp.client_code = ac.client_code
LEFT JOIN credits   cr ON cr.client_code = ac.client_code
LEFT JOIN agg       a  ON a.client_code  = ac.client_code
LEFT JOIN lastpay   lp ON lp.client_code = ac.client_code
WHERE (COALESCE(tp.tp,0) - COALESCE(cr.credits,0)) <> 0
   OR COALESCE(a.b_0_30,0)+COALESCE(a.b_31_60,0)+COALESCE(a.b_61_90,0)+COALESCE(a.b_90plus,0) <> 0
ORDER BY COALESCE(a.b_90plus,0) DESC, net_balance DESC;
$function$;
