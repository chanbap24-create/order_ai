-- 수금일정표(fn_collection_schedule) 글라스 2025-08-01 전산이관 컷오프 적용.
-- 버그: 글라스 net_now/net_close/period_* 가 glass_shipments·glass_payments 를 컷오프 없이 전부 합산 →
--   이관 전(2025-08-01 이전) 옛 출고가 유령 미수로 잡혀, 온스크린 미수현황(calc_glass_outstanding_v2,
--   2025-08-01 컷오프 적용)엔 안 나오는 거래처가 수금일정표엔 나타남 (예: 레뱅 29021).
-- 수정: 글라스 출고/수금 합산에 ship_date/payment_date >= '2025-08-01' 조건 추가(이월=carryover가 이관 전 잔액 기준).
--   와인 분기는 변경 없음.
CREATE OR REPLACE FUNCTION public.fn_collection_schedule(p_manager text, p_type text, p_as_of date DEFAULT CURRENT_DATE)
 RETURNS TABLE(client_code text, client_name text, business_type text, net_now bigint, net_close bigint, period_supply bigint, period_tax bigint, period_total bigint, period_payment bigint, payment_type text, manual_amount boolean, close_date date, promised_date date, promised_amount bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  WITH cd_close AS (
    SELECT (CASE WHEN EXTRACT(DAY FROM p_as_of) >= 21
                 THEN date_trunc('month', p_as_of)::date + 19
                 ELSE date_trunc('month', p_as_of)::date - 1 END) AS d
  ),
  gcut AS (SELECT '2025-08-01'::date AS d),  -- 글라스 전산이관 컷오프
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
      f.promised_date, f.promised_amount,
      (CASE WHEN f.payment_type IN ('nm5','nm10','nm15','nm20','nme')
            THEN (date_trunc('month', p_as_of)::date - 1)
            ELSE (SELECT d FROM cd_close) END) AS cl_d
    FROM dedup d
    LEFT JOIN collection_followups f ON f.client_code=d.client_code AND f.client_type=p_type
  ),
  calc AS (
    SELECT c.client_code, c.client_name, c.business_type, c.payment_type, c.manual_amount, c.cl_d,
      c.promised_date, c.promised_amount,
      (CASE WHEN p_type='glass' THEN
        (SELECT COALESCE(SUM(carryover_amount),0) FROM glass_client_carryover WHERE client_code=c.client_code)
        + (SELECT COALESCE(SUM(total_amount),0) FROM glass_shipments WHERE client_code=c.client_code AND ship_date::date >= (SELECT d FROM gcut) AND ship_date::date<=p_as_of)
        - (SELECT COALESCE(SUM(amount),0) FROM glass_payments WHERE client_code=c.client_code AND payment_date::date >= (SELECT d FROM gcut) AND payment_date::date<=p_as_of)
      ELSE
        (SELECT COALESCE(SUM(carryover_amount),0) FROM client_carryover WHERE client_code=c.client_code)
        + (SELECT COALESCE(SUM(total_amount),0) FROM shipments WHERE client_code=c.client_code AND ship_date::date<=p_as_of)
        - (SELECT COALESCE(SUM(amount),0) FROM payments WHERE client_code=c.client_code AND payment_date::date<=p_as_of)
      END)::bigint AS net_now,
      (CASE WHEN p_type='glass' THEN
        (SELECT COALESCE(SUM(carryover_amount),0) FROM glass_client_carryover WHERE client_code=c.client_code)
        + (SELECT COALESCE(SUM(total_amount),0) FROM glass_shipments WHERE client_code=c.client_code AND ship_date::date >= (SELECT d FROM gcut) AND ship_date::date<=c.cl_d)
        - (SELECT COALESCE(SUM(amount),0) FROM glass_payments WHERE client_code=c.client_code AND payment_date::date >= (SELECT d FROM gcut) AND payment_date::date<=c.cl_d)
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
    calc.payment_type, calc.manual_amount, calc.cl_d,
    calc.promised_date, calc.promised_amount
  FROM calc
  WHERE calc.net_now <> 0
  ORDER BY calc.net_now DESC;
$function$;
