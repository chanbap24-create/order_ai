-- 어드민 매출분석(fn_client_analysis) 글라스 담당 필터를 현재 담당(glass_clients.manager) 스코프로.
-- (와인은 이미 client_details 스코프. 함수 본문이 방대해 해당 필터 문자열만 안전 치환 후 재생성.)
DO $do$
DECLARE def text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO def FROM pg_proc WHERE proname = 'fn_client_analysis';
  IF def NOT LIKE '%IF p_type = ''glass'' THEN where_clause := where_clause || format('' AND manager = %L'', p_manager);%' THEN
    RAISE EXCEPTION 'target filter string not found — manual review needed';
  END IF;
  def := replace(def,
    'IF p_type = ''glass'' THEN where_clause := where_clause || format('' AND manager = %L'', p_manager);',
    'IF p_type = ''glass'' THEN where_clause := where_clause || format('' AND client_code IN (SELECT client_code FROM glass_clients WHERE manager = %L)'', p_manager);');
  EXECUTE def;
END $do$;
