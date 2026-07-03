-- 수금일 설정 거래처 목록: wine 분기에 활성 필터 추가.
-- 2025-08-01 이후 출고(거래) 있는 거래처만 — 옛 비활성 거래처가 전부 뜨던 문제 해결.
-- (같은 RPC를 알림 '미설정' 카운트(unset)도 사용 → 함께 정상화)
CREATE OR REPLACE FUNCTION public.fn_client_payment_terms(p_manager text, p_type text)
RETURNS TABLE(client_code text, client_name text, payment_type text)
LANGUAGE sql STABLE SECURITY DEFINER AS $function$
  WITH cl AS (
    -- wine: client_details 단일 담당 + 2025-08 이후 거래(출고) 있는 거래처만
    SELECT cd.client_code, COALESCE(cd.client_name, cd.client_code) AS client_name
    FROM client_details cd
    WHERE p_type = 'wine' AND cd.manager = p_manager AND cd.client_type = 'wine'
      AND (cd.client_name IS NULL OR UPPER(cd.client_name) NOT LIKE '(X)%')
      AND cd.client_code <> COALESCE(cd.client_name, '')
      AND EXISTS (
        SELECT 1 FROM shipments s
        WHERE s.client_code = cd.client_code AND s.ship_date >= '2025-08-01'
      )
    UNION
    -- glass: 이월 미수금 거래처(담당)
    SELECT client_code, client_name FROM glass_client_carryover
    WHERE p_type = 'glass' AND manager = p_manager
      AND (client_name IS NULL OR UPPER(client_name) NOT LIKE '(X)%')
    UNION
    -- glass: 최근 출고 담당 = p_manager 이고 최근 12개월 활성
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
