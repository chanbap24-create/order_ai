-- 매니저의 거래처 목록 + 현재 결제조건(payment_type). 결제일 설정 화면용.
-- wine: client_details 기준 / glass: carryover+shipments 기준(코드 충돌 회피, 법인 분리).
CREATE OR REPLACE FUNCTION public.fn_client_payment_terms(p_manager text, p_type text)
RETURNS TABLE(client_code text, client_name text, payment_type text)
LANGUAGE sql STABLE SECURITY DEFINER AS $function$
  WITH cl AS (
    SELECT client_code, COALESCE(client_name, client_code) AS client_name
    FROM client_details
    WHERE p_type = 'wine' AND manager = p_manager AND client_type = 'wine'
      AND (client_name IS NULL OR UPPER(client_name) NOT LIKE '(X)%')
      AND client_code <> COALESCE(client_name, '')
    UNION
    SELECT client_code, client_name FROM glass_client_carryover
    WHERE p_type = 'glass' AND manager = p_manager
      AND (client_name IS NULL OR UPPER(client_name) NOT LIKE '(X)%')
    UNION
    SELECT gs.client_code, gs.client_name FROM (
      SELECT DISTINCT ON (client_code) client_code, client_name
      FROM glass_shipments
      WHERE p_type = 'glass' AND manager = p_manager AND client_code IS NOT NULL
        AND client_name IS NOT NULL AND UPPER(client_name) NOT LIKE '(X)%'
      ORDER BY client_code, ship_date DESC
    ) gs
    WHERE NOT EXISTS (SELECT 1 FROM glass_clients gc WHERE gc.client_code = gs.client_code AND UPPER(gc.client_name) LIKE '(X)%')
  ),
  dedup AS (SELECT client_code, MAX(client_name) AS client_name FROM cl GROUP BY client_code)
  SELECT d.client_code, d.client_name, f.payment_type
  FROM dedup d
  LEFT JOIN collection_followups f ON f.client_code = d.client_code AND f.client_type = p_type
  ORDER BY d.client_name;
$function$;
