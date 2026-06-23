-- 재고 스냅샷: 주 1회 품목별 재고를 적재 → 과거 '품절 여부' 판별용.
-- 추천견적 재주문 로직에서 "끊긴 와인이 우리 품절 탓(=다시 제안)인지, 거래처가 뺀 것(=무의미)인지" 구분하려면
-- 특정 시점에 그 품목 재고가 있었는지 알아야 하는데, inventory_cdv/dl 은 덮어쓰기라 과거가 안 남음 → 여기에 누적.
-- 규모: CDV~800·DL~1000 품목 × 주1회 ≈ 연 9만행(수MB). 18개월 지난 건 자동 삭제.

CREATE TABLE IF NOT EXISTS inventory_snapshot (
  snapshot_date date NOT NULL,
  side text NOT NULL,                 -- 'cdv' | 'dl'
  item_no text NOT NULL,
  available_stock real NOT NULL DEFAULT 0,
  total_stock real NOT NULL DEFAULT 0,
  PRIMARY KEY (snapshot_date, side, item_no)
);
CREATE INDEX IF NOT EXISTS idx_inv_snapshot_item ON inventory_snapshot (side, item_no, snapshot_date);

-- 주 1회만 기록(마지막 스냅샷이 7일 이내면 스킵) + 18개월 지난 것 정리.
-- 동기화에서 매번 호출해도 안전(게이트 내장).
CREATE OR REPLACE FUNCTION record_inventory_snapshot() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  last_date date;
BEGIN
  SELECT max(snapshot_date) INTO last_date FROM inventory_snapshot;
  IF last_date IS NOT NULL AND last_date > today - 7 THEN
    RETURN; -- 이번 주 이미 기록됨
  END IF;

  INSERT INTO inventory_snapshot (snapshot_date, side, item_no, available_stock, total_stock)
    SELECT today, 'cdv', item_no, COALESCE(available_stock, 0), COALESCE(total_stock, 0)
    FROM inventory_cdv WHERE item_no IS NOT NULL
  ON CONFLICT (snapshot_date, side, item_no) DO NOTHING;

  INSERT INTO inventory_snapshot (snapshot_date, side, item_no, available_stock, total_stock)
    SELECT today, 'dl', item_no, COALESCE(available_stock, 0), COALESCE(total_stock, 0)
    FROM inventory_dl WHERE item_no IS NOT NULL
  ON CONFLICT (snapshot_date, side, item_no) DO NOTHING;

  DELETE FROM inventory_snapshot WHERE snapshot_date < today - INTERVAL '18 months';
END;
$$;
