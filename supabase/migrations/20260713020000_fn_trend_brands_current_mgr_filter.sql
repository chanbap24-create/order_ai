-- 어드민 트렌드(fn_client_daily_trend)·담당브랜드(fn_manager_brands) 담당 필터를 현재 담당 스코프로 통일.
--  · daily_trend: 와인·글라스 모두 출고당시(manager=) → 타입별 현재담당 코드 스코프
--  · manager_brands: 글라스만 출고당시 → glass_clients 스코프
DO $do$
DECLARE def text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO def FROM pg_proc WHERE proname = 'fn_client_daily_trend';
  IF def NOT LIKE '%IF p_manager <> '''' THEN where_clause := where_clause || format('' AND manager = %L'', p_manager); END IF;%' THEN
    RAISE EXCEPTION 'daily_trend: target filter string not found';
  END IF;
  def := replace(def,
    'IF p_manager <> '''' THEN where_clause := where_clause || format('' AND manager = %L'', p_manager); END IF;',
    'IF p_manager <> '''' THEN IF p_type = ''glass'' THEN where_clause := where_clause || format('' AND client_code IN (SELECT client_code FROM glass_clients WHERE manager = %L)'', p_manager); ELSE where_clause := where_clause || format('' AND client_code IN (SELECT client_code FROM client_details WHERE manager = %L AND client_type = ''''wine'''')'', p_manager); END IF; END IF;');
  EXECUTE def;

  SELECT pg_get_functiondef(oid) INTO def FROM pg_proc WHERE proname = 'fn_manager_brands';
  IF def NOT LIKE '%IF p_type = ''glass'' THEN where_clause := where_clause || format('' AND manager = %L'', p_manager);%' THEN
    RAISE EXCEPTION 'manager_brands: target filter string not found';
  END IF;
  def := replace(def,
    'IF p_type = ''glass'' THEN where_clause := where_clause || format('' AND manager = %L'', p_manager);',
    'IF p_type = ''glass'' THEN where_clause := where_clause || format('' AND client_code IN (SELECT client_code FROM glass_clients WHERE manager = %L)'', p_manager);');
  EXECUTE def;
END $do$;
