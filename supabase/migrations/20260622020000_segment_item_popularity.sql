-- 발굴/신규 추천 모드용: 업태(business_type)별 품목 인기도.
-- 같은 업태(편의점·할인점·백화점 등) 거래처들이 since 이후 많이 산 품목 → 신규 거래처 추천 가점.
CREATE OR REPLACE FUNCTION segment_item_popularity(seg text, since text)
RETURNS TABLE(item_no text, qty numeric)
LANGUAGE sql STABLE AS $$
  SELECT s.item_no, SUM(COALESCE(s.quantity,0))::numeric AS qty
  FROM shipments s
  JOIN client_details cd ON cd.client_code = s.client_code
  WHERE cd.business_type = seg
    AND s.ship_date >= since
    AND s.item_no IS NOT NULL
  GROUP BY s.item_no
$$;
