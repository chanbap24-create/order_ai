-- 수금일정표 생성용: 매니저+법인 거래처별 현재미수(net_now) + 마감일 기준 미수(net_close=이월) + 결제조건.
-- 마감일: 생성일 day>=21 → 당월20일, 아니면 전월말. (1일·21일 작성 사이클)
CREATE OR REPLACE FUNCTION public.fn_collection_schedule(p_manager text, p_type text, p_as_of date DEFAULT CURRENT_DATE)
RETURNS TABLE(
  client_code text, client_name text, business_type text,
  net_now bigint, net_close bigint,
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
  calc AS (
    SELECT c.client_code, c.client_name, c.business_type,
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
        + (SELECT COALESCE(SUM(total_amount),0) FROM glass_shipments WHERE client_code=c.client_code AND ship_date::date<=(SELECT d FROM cd_close))
        - (SELECT COALESCE(SUM(amount),0) FROM glass_payments WHERE client_code=c.client_code AND payment_date::date<=(SELECT d FROM cd_close))
      ELSE
        (SELECT COALESCE(SUM(carryover_amount),0) FROM client_carryover WHERE client_code=c.client_code)
        + (SELECT COALESCE(SUM(total_amount),0) FROM shipments WHERE client_code=c.client_code AND ship_date::date<=(SELECT d FROM cd_close))
        - (SELECT COALESCE(SUM(amount),0) FROM payments WHERE client_code=c.client_code AND payment_date::date<=(SELECT d FROM cd_close))
      END)::bigint AS net_close
    FROM dedup c
  )
  SELECT calc.client_code, calc.client_name, calc.business_type,
    calc.net_now, calc.net_close,
    f.payment_type, COALESCE(f.manual_amount,false), (SELECT d FROM cd_close)
  FROM calc
  LEFT JOIN collection_followups f ON f.client_code=calc.client_code AND f.client_type=p_type
  WHERE calc.net_now <> 0
  ORDER BY calc.net_now DESC;
$function$;
