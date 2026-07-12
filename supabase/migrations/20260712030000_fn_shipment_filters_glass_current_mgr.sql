-- 세일즈 분석 담당 드롭다운(fn_shipment_filters) — 글라스 담당 목록을 현재 담당(glass_clients.manager)으로.
--  종전 glass_shipments.manager(출고당시)라 재배정·퇴사한 옛 담당(하홍집)이 목록에 남고,
--  glass_clients에만 있는 신규 담당은 누락됐다. 와인은 이미 client_details(wine) 기준.
CREATE OR REPLACE FUNCTION public.fn_shipment_filters(p_type text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  tbl TEXT; mgr_sql TEXT; result JSON;
BEGIN
  IF p_type = 'glass' THEN tbl := 'glass_shipments'; ELSE tbl := 'shipments'; END IF;
  IF p_type = 'glass' THEN
    mgr_sql := 'SELECT DISTINCT manager AS v FROM glass_clients WHERE manager IS NOT NULL AND manager <> ''''';
  ELSE
    mgr_sql := 'SELECT DISTINCT manager AS v FROM client_details WHERE client_type = ''wine'' AND manager IS NOT NULL AND manager <> ''''';
  END IF;
  EXECUTE format(
    'SELECT json_build_object(
      ''managers'', (SELECT COALESCE(json_agg(v ORDER BY v), ''[]''::json) FROM (%s) sub),
      ''departments'', (SELECT COALESCE(json_agg(v ORDER BY v), ''[]''::json) FROM (SELECT DISTINCT department AS v FROM %I WHERE department IS NOT NULL AND department <> '''') sub),
      ''businessTypes'', (SELECT COALESCE(json_agg(v ORDER BY v), ''[]''::json) FROM (SELECT DISTINCT business_type AS v FROM %I WHERE business_type IS NOT NULL AND business_type <> '''') sub),
      ''dateRange'', json_build_object(
        ''min'', (SELECT MIN(ship_date)::TEXT FROM %I WHERE ship_date IS NOT NULL),
        ''max'', (SELECT MAX(ship_date)::TEXT FROM %I WHERE ship_date IS NOT NULL)
      )
    )',
    mgr_sql, tbl, tbl, tbl, tbl
  ) INTO result;
  RETURN result;
END;
$function$;
