-- 매니저 전체 거래처의 최근 N일 수금 합계 (완납 거래처 포함).
-- 연령분석 요약의 "최근3개월 수금"이 미수 잔존 거래처만 더해 과소집계되던 문제 보정용.
CREATE OR REPLACE FUNCTION public.fn_recent_collections(
  p_manager text, p_type text, p_as_of date DEFAULT CURRENT_DATE, p_days int DEFAULT 90
)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER AS $function$
  WITH cl AS (
    SELECT client_code FROM client_details
    WHERE p_type = 'wine' AND manager = p_manager AND client_type = 'wine'
      AND (client_name IS NULL OR UPPER(client_name) NOT LIKE '(X)%')
    UNION
    SELECT client_code FROM glass_client_carryover
    WHERE p_type = 'glass' AND manager = p_manager
      AND (client_name IS NULL OR UPPER(client_name) NOT LIKE '(X)%')
    UNION
    SELECT DISTINCT client_code FROM glass_shipments
    WHERE p_type = 'glass' AND manager = p_manager AND client_code IS NOT NULL
      AND (client_name IS NULL OR UPPER(client_name) NOT LIKE '(X)%')
  )
  SELECT COALESCE(CASE WHEN p_type = 'glass' THEN
      (SELECT SUM(gp.amount)::bigint FROM glass_payments gp
        WHERE gp.client_code IN (SELECT client_code FROM cl)
          AND gp.payment_date::date > p_as_of - p_days AND gp.payment_date::date <= p_as_of)
    ELSE
      (SELECT SUM(p.amount)::bigint FROM payments p
        WHERE p.client_code IN (SELECT client_code FROM cl)
          AND p.payment_date::date > p_as_of - p_days AND p.payment_date::date <= p_as_of)
    END, 0);
$function$;
