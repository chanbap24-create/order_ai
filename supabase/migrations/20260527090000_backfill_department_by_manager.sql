-- 2025-08 이전 shipments / glass_shipments 의 department 컬럼이 비어있어
-- 어드민 매출분석 "전년 대비 매출 비교" 에서 부서(예: 영업1부) 필터링 시
-- 작년 데이터가 누락되던 문제 해결.
--
-- 2025-08 이후 매니저별 대표 부서(mode)를 추출하여 NULL/'' row 에 일괄 채운다.
-- 매핑 점검(2026-05-27): wine 100% 단일 부서, glass 도 김동현(81%/19%), 송명진(99.8%/0.2%)
-- 두 경우만 분기되며 mode() 가 다수 부서를 정확히 선택. 매핑 불가능 row 0 건.
--
-- 멱등성: department IS NULL OR department = '' 조건이라 재실행해도 동일 결과.

-- 1) wine shipments backfill
WITH manager_dept AS (
  SELECT manager, mode() WITHIN GROUP (ORDER BY department) AS department
  FROM shipments
  WHERE ship_date >= '2025-08-01'
    AND manager IS NOT NULL AND manager <> ''
    AND department IS NOT NULL AND department <> ''
  GROUP BY manager
)
UPDATE shipments s
SET department = m.department
FROM manager_dept m
WHERE s.ship_date < '2025-08-01'
  AND (s.department IS NULL OR s.department = '')
  AND s.manager = m.manager
  AND m.department IS NOT NULL;

-- 2) glass shipments backfill
WITH manager_dept AS (
  SELECT manager, mode() WITHIN GROUP (ORDER BY department) AS department
  FROM glass_shipments
  WHERE ship_date >= '2025-08-01'
    AND manager IS NOT NULL AND manager <> ''
    AND department IS NOT NULL AND department <> ''
  GROUP BY manager
)
UPDATE glass_shipments s
SET department = m.department
FROM manager_dept m
WHERE s.ship_date < '2025-08-01'
  AND (s.department IS NULL OR s.department = '')
  AND s.manager = m.manager
  AND m.department IS NOT NULL;
