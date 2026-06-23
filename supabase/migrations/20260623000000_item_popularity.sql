-- 발굴 모드 '인기 아이템' 재정의용 글로벌 집계.
-- 수량 1등 대비 비율(편향: 싼 대량·한 거래처 대량)이 아니라,
-- 품목별 '구매 거래처 수(breadth)·매출·최근 구매처'를 백분위로 평가하기 위한 원천.
CREATE OR REPLACE FUNCTION item_popularity(since text, recent_since text)
RETURNS TABLE(item_no text, buyers int, revenue numeric, recent_buyers int)
LANGUAGE sql STABLE AS $$
  SELECT s.item_no,
    count(DISTINCT s.client_code)::int AS buyers,
    sum(COALESCE(s.quantity,0) * COALESCE(s.unit_price,0))::numeric AS revenue,
    count(DISTINCT s.client_code) FILTER (WHERE s.ship_date >= recent_since)::int AS recent_buyers
  FROM shipments s
  WHERE s.ship_date >= since AND s.item_no IS NOT NULL AND COALESCE(s.quantity,0) > 0
  GROUP BY s.item_no
$$;
