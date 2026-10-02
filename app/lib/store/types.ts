// 점장 매장 앱 공용 상수·타입 — 클라이언트에서도 임포트하므로 서버 모듈(db 등) 금지.

export type Corp = 'cdv' | 'dl';

/** 백화점 매장 — 재고 테이블 컬럼 키와 라벨 (법인별, 화면 순서) */
export const STORES = [
  // 까브드뱅 (inventory_cdv) — 표시명은 소믈리에(quiz.ts STORES)와 동일 기준
  { key: 'store_thehyundai', label: '더현대 서울', corp: 'cdv' },
  { key: 'store_ssg_gangnam', label: '신세계백화점 HOS', corp: 'cdv' },
  { key: 'store_hyundai_main', label: '현대백화점 압구정본점', corp: 'cdv' },
  { key: 'store_hyundai_trade', label: '현대백화점 무역센터점', corp: 'cdv' },
  { key: 'store_hyundai_jungdong', label: '현대백화점 중동점', corp: 'cdv' },
  // 대유라이프 (inventory_dl)
  { key: 'store_ssg_gangnam_dl', label: '신세계백화점 강남점', corp: 'dl' },
  { key: 'store_ssg_southcity', label: '신세계 사우스시티', corp: 'dl' },
] as const;
export type StoreKey = (typeof STORES)[number]['key'];

export const CORP_LABEL: Record<Corp, string> = { cdv: '까브드뱅', dl: '대유라이프' };

export function corpOfStore(key: string): Corp {
  return STORES.find((s) => s.key === key)?.corp === 'dl' ? 'dl' : 'cdv';
}

/** 해당 매장과 같은 법인의 매장 목록 (상세 시트 위치별 표시용) */
export function storesOfCorp(corp: Corp) {
  return STORES.filter((s) => s.corp === corp);
}

/** 와인 품번 판정 — 자사 0~5·A + 타사 ZK. 단 ZK00xxx는 타사 액세서리(스토퍼·브루카트 등)라 제외. */
export function isWineItemNo(itemNo: string): boolean {
  const no = String(itemNo || '');
  return /^[0-5A]/i.test(no) || /^ZK(?!00)/i.test(no);
}

/** 빈티지 = 와인 품번 3~4자리 (ERP 빈티지 컬럼은 신뢰 불가 — vintage formula 정본).
 *  예: 0019044→2019, 2021474→2021, ZK22159→2022, ZKNV308→NV. 글라스·액세서리는 null. */
export function vintageOfItemNo(itemNo: string): string | null {
  const no = String(itemNo || '');
  if (!isWineItemNo(no)) return null;
  if (/^ZKNV/i.test(no) || /^[A-Z0-9]{2}NV/i.test(no)) return 'NV'; // 품번 3~4자리 NV (예: 00NV801 찰스 하이직)
  const m = no.match(/^[A-Z0-9]{2}(\d{2})/i);
  if (!m) return null;
  const yy = Number(m[1]);
  return String(yy >= 50 ? 1900 + yy : 2000 + yy);
}

export type StoreStockRow = {
  item_no: string;
  item_name: string;
  vintage: string | null;
  retail_price: number;       // 정상 판매가
  sale_price: number;         // 백화점 할인가 (CDV: 소믈리에 밴드 / DL: 정상가 그대로)
  discount_rate: number;
  hq_available: number;       // 본사 가용
  hq_bonded: number;          // 보세 (통관 전)
  incoming: number;           // 입고 예정 수량(재고표)
  arrival_date: string | null; // 다음 입항일 (CDV 수입 스케줄)
  arrival_btls: number;
  stores: Partial<Record<StoreKey, number>>;
  store_total: number;        // 같은 법인 전 매장 합
};

/** 재고 위치 구역 — 0 우리 매장 · 1 다른 매장 · 2 본사(가용·보세·입고) · 3 없음. 목록 음영·정렬 공용. */
export type StockTier = 0 | 1 | 2 | 3;
export function stockTierOf(row: StoreStockRow, storeKey: StoreKey): StockTier {
  const mine = row.stores[storeKey] || 0;
  if (mine > 0) return 0;
  if (row.store_total - mine > 0) return 1;
  if (row.hq_available + row.hq_bonded + row.incoming + row.arrival_btls > 0) return 2;
  return 3;
}

/** 구역 순 안정 정렬 — 같은 구역 안에서는 기존(검색 관련도) 순서 유지 */
export function sortByTier(rows: StoreStockRow[], storeKey: StoreKey): StoreStockRow[] {
  return rows.map((r, i) => ({ r, i, t: stockTierOf(r, storeKey) }))
    .sort((a, b) => a.t - b.t || a.i - b.i)
    .map((x) => x.r);
}
