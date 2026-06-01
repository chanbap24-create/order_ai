-- 글라스 수금일 설정 거래처를 '최근 출고 담당(거래처당 1명) + 최근 12개월 활성'으로 한정.
-- 기존엔 한 번이라도 출고한 담당 모두에게 + 비활성까지 다 노출됨(조성재 1024곳 등 → 347곳).
-- 이월 미수금 거래처는 활성 무관 포함. wine(client_details 단일 담당)은 변경 없음.
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
    SELECT latest.client_code, latest.client_name FROM (
      SELECT DISTINCT ON (client_code) client_code, client_name, manager, ship_date
      FROM glass_shipments
      WHERE p_type = 'glass' AND manager IS NOT NULL AND client_code IS NOT NULL
        AND client_name IS NOT NULL AND UPPER(client_name) NOT LIKE '(X)%'
      ORDER BY client_code, ship_date DESC
    ) latest
    WHERE latest.manager = p_manager
      AND latest.ship_date::date >= (CURRENT_DATE - INTERVAL '12 months')::date
      AND NOT EXISTS (SELECT 1 FROM glass_clients gc WHERE gc.client_code = latest.client_code AND UPPER(gc.client_name) LIKE '(X)%')
  ),
  dedup AS (SELECT client_code, MAX(client_name) AS client_name FROM cl GROUP BY client_code)
  SELECT d.client_code, d.client_name, f.payment_type
  FROM dedup d
  LEFT JOIN collection_followups f ON f.client_code = d.client_code AND f.client_type = p_type
  ORDER BY d.client_name;
$function$;
