// 재고 합산의 단일 정의 (앱 레벨) — DB 생성 컬럼(stock_bonded/stock_total/stock_pipeline)과 쌍.
//
// 규칙(CLAUDE.md): 재고 합산 수식을 이 파일 밖에서 인라인으로 다시 쓰지 말 것.
// 창고 구조가 바뀌면(예: 보세 창고 추가) ① DB 생성 컬럼 정의 ② 이 파일 — 두 곳만 수정한다.
//
// 사용 우선순위:
//  1) 새 쿼리는 생성 컬럼을 직접 select: stock_total / stock_bonded / stock_pipeline
//     - 재고 필터: .gt('stock_total', 0)  (기존 .or('available_stock.gt.0,...') 대체)
//  2) 원시 컬럼을 이미 들고 있는 코드는 아래 헬퍼로 계산

/** 원시 창고 컬럼 select 조각 — 개별 창고 표시가 필요한 화면용 */
export const RAW_STOCK_COLUMNS = 'available_stock, bonded_warehouse, bonded_kctc, incoming_stock';
/** 생성 컬럼 select 조각 — 합계만 필요한 로직용 */
export const STOCK_COLUMNS = 'stock_total, stock_bonded, stock_pipeline';

// ⚠️ kctc 컬럼은 별도 창고가 아니라 "가용재고의 위치 분해"(가용 62 = KCTC에 62 위치)다.
//    합산에 넣으면 이중계상(재고 2배 뻥튀기) — 2026-08-31 데이터 검증으로 확정. 합산 금지.

type RawStockRow = {
  available_stock?: number | null;
  bonded_warehouse?: number | null;
  bonded_kctc?: number | null;
  incoming_stock?: number | null;
};

/** 보세 합계 = 용마 잔여 + KCTC 보세 */
export const bondedOf = (r: RawStockRow): number =>
  (Number(r.bonded_warehouse) || 0) + (Number(r.bonded_kctc) || 0);

/** 판매 가능 판정용 합계 = 가용 + 보세 */
export const totalStockOf = (r: RawStockRow): number =>
  (Number(r.available_stock) || 0) + bondedOf(r);

/** 파이프라인 합계 = 가용 + 보세 + 입고예정 (신규/입항 와인 포함 판정용) */
export const pipelineStockOf = (r: RawStockRow): number =>
  totalStockOf(r) + (Number(r.incoming_stock) || 0);
