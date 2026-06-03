-- 매출분석 근본 최적화: shipments.ship_date 가 text(10자 ISO 'YYYY-MM-DD')인데
-- 분석 함수들이 'ship_date::date >= X::date' 로 필터 → text→date 캐스트가 non-IMMUTABLE 이라
-- 인덱스(idx_shipments_ship_date)를 못 쓰고 매 호출 전체 seq scan(194k행) 발생.
-- (특히 cold/동시부하 시 수 초). 전 행이 정확히 10자 ISO 라 'ship_date >= X'(text 비교)와
-- 'ship_date::date >= X::date' 는 100% 동일 → text 조건으로 치환해 btree 인덱스(bitmap scan) 사용.
-- 효과: shipments 스캔 버퍼 7199→1573(4.6배↓), warm 651ms→416ms, cold 대폭 개선.
-- 검증: 총매출/랭킹 직접 집계와 일치(동점 항목 정렬 순서만 스캔방식 변경으로 달라짐 — 둘 다 유효).
-- glass_shipments.ship_date 는 date 타입이라 동일 치환해도 결과/인덱스 사용 동일.
-- 저장된 정의를 직접 치환해 재생성(전사 오류 0, 멱등 — 이미 text 면 no-op).
DO $o$
DECLARE
  def text;
  fns text[] := ARRAY[
    'fn_client_analysis(text,text,text,text,text,text,text)',
    'fn_manager_brands(text,text,text,text,text,text,text)',
    'fn_client_daily_trend(text,text,text,text,text,text,text)',
    'fn_client_detail(text,text,text,text)'
  ];
  fn text;
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    def := pg_get_functiondef(fn::regprocedure);
    def := replace(def, 'ship_date::date >= %L::date', 'ship_date >= %L');
    def := replace(def, 'ship_date::date <= %L::date', 'ship_date <= %L');
    EXECUTE def;
  END LOOP;
END $o$;
