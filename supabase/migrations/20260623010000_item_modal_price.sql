-- 권장 할인율용: 영업범위(매니저 집합)의 최근 N개월 품목별 '가장 많이 나간 판매가'(최빈) + 공급가.
-- 판매가 = LEAST(NULLIF(unit_price,0), NULLIF(selling_price,0))  ← Q열 판매단가 추출(판매단가 ≤ 공급가).
--   (현재 데이터: unit_price=공급가, selling_price=판매단가. unit_price 단독이면 할인 0으로 나옴)
-- exclude=true 면 그 매니저들 제외(나머지 영업팀). 할인 = 1 - 최빈판매가/공급가.
CREATE OR REPLACE FUNCTION item_modal_price(managers text[], since text, exclude boolean DEFAULT false)
RETURNS TABLE(item_no text, modal_price numeric, supply_price numeric, n int)
LANGUAGE sql STABLE AS $$
  SELECT DISTINCT ON (t.item_no) t.item_no, t.sale_price::numeric AS modal_price, i.supply_price::numeric AS supply_price, t.cnt::int AS n
  FROM (
    SELECT s.item_no, LEAST(NULLIF(s.unit_price,0), NULLIF(s.selling_price,0)) AS sale_price, count(*) AS cnt
    FROM shipments s
    JOIN client_details cd ON cd.client_code = s.client_code
    WHERE s.ship_date >= since AND s.item_no IS NOT NULL
      AND LEAST(NULLIF(s.unit_price,0), NULLIF(s.selling_price,0)) > 0
      AND ((NOT exclude AND trim(cd.manager) = ANY(managers))
        OR (exclude AND (cd.manager IS NULL OR trim(cd.manager) <> ALL(managers))))
    GROUP BY s.item_no, LEAST(NULLIF(s.unit_price,0), NULLIF(s.selling_price,0))
  ) t
  JOIN inventory_cdv i ON i.item_no = t.item_no
  WHERE i.supply_price > 0
  ORDER BY t.item_no, t.cnt DESC, t.sale_price DESC
$$;
-- (판매 이력 없는 품목은 권장 미부여 — 폴백 없음. team_typical_discount RPC는 미사용으로 제거됨)
