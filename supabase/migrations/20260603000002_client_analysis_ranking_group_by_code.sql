-- 거래처별 매출 순위: client_agg 가 (code, name)으로 그룹핑돼, 거래처명 표기 변형
-- (예: "(주)" 유무)으로 동일 거래처가 2행으로 분리 → 매출 분할 + React 중복키 에러.
-- 함수의 다른 모든 집계(distinct_clients, 담당자 client_count, prevRanking)는 code 기준이므로
-- ranking 도 code 기준으로 통일. 거래처명은 정렬 없는 max() 로 대표값 1개 선택(성능 안전).
-- 저장된 정의를 직접 치환해 재생성(전사 오류 0, 멱등 — 이미 적용돼 있으면 no-op replace).
DO $outer$
DECLARE def text;
BEGIN
  SELECT pg_get_functiondef('fn_client_analysis(text,text,text,text,text,text,text)'::regprocedure) INTO def;
  def := replace(def,
    'SELECT f.client_code, f.client_name,',
    'SELECT f.client_code, max(f.client_name) AS client_name,');
  def := replace(def,
    'FROM filtered f GROUP BY f.client_code, f.client_name',
    'FROM filtered f GROUP BY f.client_code');
  EXECUTE def;
END $outer$;
