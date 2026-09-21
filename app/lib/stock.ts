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

// ── 백화점 매장 재고 노출 제한 ──────────────────────────────────────────
// ERP total_stock(재고수량)에는 백화점 매장 재고가 포함된다.
// 백화점 채널은 영업2부 소관 — 영업2부(+관리자·임원) 외에는 인벤토리에서
// 매장 재고를 보지 못하게 total_stock에서 매장분을 빼고 매장 컬럼을 제거한다.

/** CDV 재고표의 백화점 매장 컬럼 */
export const DEPT_STORE_COLS_CDV = [
  'store_hyundai_main', 'store_hyundai_jungdong', 'store_hyundai_trade', 'store_ssg_gangnam', 'store_thehyundai',
] as const;
/** DL 재고표의 백화점 매장 컬럼 */
export const DEPT_STORE_COLS_DL = ['store_ssg_gangnam_dl', 'store_ssg_southcity'] as const;

/** 백화점 매장 재고를 볼 수 있는 계정 — 영업2부 또는 관리자급 */
export function canSeeDeptStoreStock(s: { department?: string; role?: string } | null): boolean {
  if (!s) return false;
  if (s.department === '영업2부') return true;
  return ['admin', 'sales_admin', 'executive'].includes(s.role || '');
}

/** 권한 없는 계정용 행 마스킹 — total_stock에서 매장분 차감 + 매장 컬럼 제거 */
export function stripDeptStoreStock<T extends Record<string, unknown>>(
  rows: T[],
  tab: 'CDV' | 'DL',
): T[] {
  const cols = tab === 'DL' ? DEPT_STORE_COLS_DL : DEPT_STORE_COLS_CDV;
  return rows.map((r) => {
    const out: Record<string, unknown> = { ...r };
    let stores = 0;
    for (const c of cols) {
      stores += Number(out[c]) || 0;
      delete out[c];
    }
    if (stores > 0 && typeof out.total_stock === 'number') {
      out.total_stock = Math.max(0, (out.total_stock as number) - stores);
    }
    return out as T;
  });
}
