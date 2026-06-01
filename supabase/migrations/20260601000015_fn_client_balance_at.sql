-- 특정 날짜 기준 거래처 미수 잔액 (이월 + 출고≤date - 수금≤date). 수금일 변경 시 약속 금액 재계산용.
CREATE OR REPLACE FUNCTION public.fn_client_balance_at(p_code text, p_type text, p_date date)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER AS $function$
  SELECT (CASE WHEN p_type='glass' THEN
    (SELECT COALESCE(SUM(carryover_amount),0) FROM glass_client_carryover WHERE client_code=p_code)
    + (SELECT COALESCE(SUM(total_amount),0) FROM glass_shipments WHERE client_code=p_code AND ship_date::date<=p_date)
    - (SELECT COALESCE(SUM(amount),0) FROM glass_payments WHERE client_code=p_code AND payment_date::date<=p_date)
  ELSE
    (SELECT COALESCE(SUM(carryover_amount),0) FROM client_carryover WHERE client_code=p_code)
    + (SELECT COALESCE(SUM(total_amount),0) FROM shipments WHERE client_code=p_code AND ship_date::date<=p_date)
    - (SELECT COALESCE(SUM(amount),0) FROM payments WHERE client_code=p_code AND payment_date::date<=p_date)
  END)::bigint;
$function$;
