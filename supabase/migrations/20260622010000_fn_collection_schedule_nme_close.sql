-- 수금일정표: 익월말(nme) 거래처의 이월 기준일을 '전월말'로 보정.
-- 문제: 마감일이 day>=21 → 당월20일로 고정되어, 익월말 거래처의 '이번달 출고'(20일 이전분)가
--       이월(net_close)에 포함 → 입금예정금액이 총미수 전액으로 잡힘.
-- 수정: 익월말은 이번달 출고가 익월말 결제분이므로 이월 기준일을 전월말로 두어
--       이번달 출고를 당월신규(미수잔액)로 분리. 그 외 결제조건은 기존 마감일 유지.
DROP FUNCTION IF EXISTS public.fn_collection_schedule(text, text, date);
CREATE OR REPLACE FUNCTION public.fn_collection_schedule(p_manager text, p_type text, p_as_of date DEFAULT CURRENT_DATE)
RETURNS TABLE(
  client_code text, client_name text, business_type text,
  net_now bigint, net_close bigint,
  period_supply bigint, period_tax bigint, period_total bigint, period_payment bigint,
  payment_type text, manual_amount boolean, close_date date
)
LANGUAGE sql STABLE SECURITY DEFINER AS $function$
  WITH cd_close AS (
    SELECT (CASE WHEN EXTRACT(DAY FROM p_as_of) >= 21
                 THEN date_trunc('month', p_as_of)::date + 19
                 ELSE date_trunc('month', p_as_of)::date - 1 END) AS d
  ),
  clients AS (
    SELECT cd.client_code, COALESCE(cd.client_name, cd.client_code) AS client_name, cd.business_type
    FROM client_details cd
    WHERE p_type = 'wine' AND cd.manager = p_manager AND cd.client_type = 'wine'
      AND (cd.client_name IS NULL OR UPPER(cd.client_name) NOT LIKE '(X)%')
      AND cd.client_code <> COALESCE(cd.client_name, '')
    UNION
    SELECT g.client_code, g.client_name, NULL::text
    FROM (SELECT DISTINCT ON (client_code) client_code, client_name, manager
          FROM glass_shipments
          WHERE p_type = 'glass' AND manager IS NOT NULL AND client_name IS NOT NULL AND UPPER(client_name) NOT LIKE '(X)%'
          ORDER BY client_code, ship_date DESC) g
    WHERE g.manager = p_manager
    UNION
    SELECT gco.client_code, gco.client_name, NULL::text
    FROM glass_client_carryover gco
    WHERE p_type = 'glass' AND gco.manager = p_manager AND (gco.client_name IS NULL OR UPPER(gco.client_name) NOT LIKE '(X)%')
  ),
  dedup AS (SELECT client_code, MAX(client_name) AS client_name, MAX(business_type) AS business_type FROM clients GROUP BY client_code),
  base AS (
    SELECT d.client_code, d.client_name, d.business_type,
      f.payment_type, COALESCE(f.manual_amount,false) AS manual_amount,
      -- 익월말(nme): 이번달 출고는 익월말 결제분 → 이월 기준일을 전월말로
      (CASE WHEN f.payment_type = 'nme'
            THEN (date_trunc('month', p_as_of)::date - 1)
            ELSE (SELECT d FROM cd_close) END) AS cl_d
    FROM dedup d
    LEFT JOIN collection_followups f ON f.client_code=d.client_code AND f.client_type=p_type
  ),
  calc AS (
    SELECT c.client_code, c.client_name, c.business_type, c.payment_type, c.manual_amount, c.cl_d,
      (CASE WHEN p_type='glass' THEN
        (SELECT COALESCE(SUM(carryover_amount),0) FROM glass_client_carryover WHERE client_code=c.client_code)
        + (SELECT COALESCE(SUM(total_amount),0) FROM glass_shipments WHERE client_code=c.client_code AND ship_date::date<=p_as_of)
        - (SELECT COALESCE(SUM(amount),0) FROM glass_payments WHERE client_code=c.client_code AND payment_date::date<=p_as_of)
      ELSE
        (SELECT COALESCE(SUM(carryover_amount),0) FROM client_carryover WHERE client_code=c.client_code)
        + (SELECT COALESCE(SUM(total_amount),0) FROM shipments WHERE client_code=c.client_code AND ship_date::date<=p_as_of)
        - (SELECT COALESCE(SUM(amount),0) FROM payments WHERE client_code=c.client_code AND payment_date::date<=p_as_of)
      END)::bigint AS net_now,
      (CASE WHEN p_type='glass' THEN
        (SELECT COALESCE(SUM(carryover_amount),0) FROM glass_client_carryover WHERE client_code=c.client_code)
        + (SELECT COALESCE(SUM(total_amount),0) FROM glass_shipments WHERE client_code=c.client_code AND ship_date::date<=c.cl_d)
        - (SELECT COALESCE(SUM(amount),0) FROM glass_payments WHERE client_code=c.client_code AND payment_date::date<=c.cl_d)
      ELSE
        (SELECT COALESCE(SUM(carryover_amount),0) FROM client_carryover WHERE client_code=c.client_code)
        + (SELECT COALESCE(SUM(total_amount),0) FROM shipments WHERE client_code=c.client_code AND ship_date::date<=c.cl_d)
        - (SELECT COALESCE(SUM(amount),0) FROM payments WHERE client_code=c.client_code AND payment_date::date<=c.cl_d)
      END)::bigint AS net_close,
      (CASE WHEN p_type='glass' THEN (SELECT COALESCE(SUM(supply_amount),0) FROM glass_shipments WHERE client_code=c.client_code AND ship_date::date>c.cl_d AND ship_date::date<=p_as_of)
        ELSE (SELECT COALESCE(SUM(supply_amount),0) FROM shipments WHERE client_code=c.client_code AND ship_date::date>c.cl_d AND ship_date::date<=p_as_of) END)::bigint AS period_supply,
      (CASE WHEN p_type='glass' THEN (SELECT COALESCE(SUM(tax_amount),0) FROM glass_shipments WHERE client_code=c.client_code AND ship_date::date>c.cl_d AND ship_date::date<=p_as_of)
        ELSE (SELECT COALESCE(SUM(tax_amount),0) FROM shipments WHERE client_code=c.client_code AND ship_date::date>c.cl_d AND ship_date::date<=p_as_of) END)::bigint AS period_tax,
      (CASE WHEN p_type='glass' THEN (SELECT COALESCE(SUM(total_amount),0) FROM glass_shipments WHERE client_code=c.client_code AND ship_date::date>c.cl_d AND ship_date::date<=p_as_of)
        ELSE (SELECT COALESCE(SUM(total_amount),0) FROM shipments WHERE client_code=c.client_code AND ship_date::date>c.cl_d AND ship_date::date<=p_as_of) END)::bigint AS period_total,
      (CASE WHEN p_type='glass' THEN (SELECT COALESCE(SUM(amount),0) FROM glass_payments WHERE client_code=c.client_code AND payment_date::date>c.cl_d AND payment_date::date<=p_as_of)
        ELSE (SELECT COALESCE(SUM(amount),0) FROM payments WHERE client_code=c.client_code AND payment_date::date>c.cl_d AND payment_date::date<=p_as_of) END)::bigint AS period_payment
    FROM base c
  )
  SELECT calc.client_code, calc.client_name, calc.business_type,
    calc.net_now, calc.net_close, calc.period_supply, calc.period_tax, calc.period_total, calc.period_payment,
    calc.payment_type, calc.manual_amount, calc.cl_d
  FROM calc
  WHERE calc.net_now <> 0
  ORDER BY calc.net_now DESC;
$function$;
