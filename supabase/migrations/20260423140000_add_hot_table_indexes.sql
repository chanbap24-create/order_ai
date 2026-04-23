-- 핫 테이블 인덱스 추가
-- 목적: 자주 조합되는 필터/정렬 쿼리에 복합 인덱스 및 부분 인덱스 추가
-- 생성일: 2026-04-23
--
-- 기존 인덱스 (psql 조사 결과):
--   shipments: manager / ship_date / client_code / item_no 단독 인덱스 존재 → compound 추가
--   glass_shipments: (client_code, ship_date) compound 이미 있음, (manager, ship_date) 는 없음
--   inventory_cdv: PK(item_no) 만 있음 → 재고 보유 partial 추가
--   wines: PK(item_code) 만 있음 → brand / status 추가
--   wine_images: PK(id) 만 있음 → wine_id 추가
--   clients / glass_clients: PK 가 client_code 여부에 따라 불필요할 수도 있음 → 확인 후 생략

-- ══════════════════════════════════════════════════════════════════
-- shipments 복합 인덱스
-- ══════════════════════════════════════════════════════════════════
-- 핫 쿼리 패턴:
--   .eq('manager', X).gte('ship_date', Y)          — alerts, actions, client-list
--   .eq('client_code', X).gte('ship_date', Y)      — recommend, briefing, ledger, preferences, stats
-- 단독 인덱스 2개의 bitmap AND 보다 compound index 가 훨씬 빠름.
CREATE INDEX IF NOT EXISTS idx_shipments_manager_ship_date
  ON shipments (manager, ship_date DESC);

CREATE INDEX IF NOT EXISTS idx_shipments_client_code_ship_date
  ON shipments (client_code, ship_date DESC);

-- ══════════════════════════════════════════════════════════════════
-- glass_shipments 복합 인덱스
-- (client_code, ship_date) 는 이미 존재하므로 manager, ship_date 만 추가
-- ══════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_glass_shipments_manager_ship_date
  ON glass_shipments (manager, ship_date DESC);

-- ══════════════════════════════════════════════════════════════════
-- inventory_cdv: 재고 보유 품목만 부분 인덱스
-- ══════════════════════════════════════════════════════════════════
-- recommend/alerts/briefing 에서 자주 사용하는 패턴:
--   .or('available_stock.gt.0,bonded_warehouse.gt.0')
-- 재고 없는 품목이 절반 이상일 때 인덱스 크기/탐색 비용 절감
CREATE INDEX IF NOT EXISTS idx_inventory_cdv_in_stock
  ON inventory_cdv (item_no)
  WHERE available_stock > 0 OR bonded_warehouse > 0;

-- ══════════════════════════════════════════════════════════════════
-- wines: brand / status
-- ══════════════════════════════════════════════════════════════════
-- getWinesByBrandCode (관리자 브랜드 연결 와인 조회)
CREATE INDEX IF NOT EXISTS idx_wines_brand
  ON wines (brand);

-- status='new' 필터 (관리자 신규 와인 탭)
CREATE INDEX IF NOT EXISTS idx_wines_status
  ON wines (status);

-- ══════════════════════════════════════════════════════════════════
-- wine_images: wine_id 로 JOIN/삭제 빈번
-- ══════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_wine_images_wine_id
  ON wine_images (wine_id);

-- ══════════════════════════════════════════════════════════════════
-- 통계 갱신 (새 인덱스 반영)
-- ══════════════════════════════════════════════════════════════════
ANALYZE shipments;
ANALYZE glass_shipments;
ANALYZE inventory_cdv;
ANALYZE wines;
ANALYZE wine_images;
