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

/** 매장 앱 보기 범위 — 매장 직원 계정은 자기 매장 고정, 본사 계정은 'all'(전체 매장·조회 전용). 로그인 세션이 정한다 */
export type StoreView = StoreKey | 'all';
export const isStoreKey = (k: unknown): k is StoreKey => STORES.some((s) => s.key === k);
export const storeViewLabel = (v: StoreView | '') => (v === 'all' ? '전체 매장' : STORES.find((s) => s.key === v)?.label || '');
/** 이 보기에서의 '매장 재고' — 전체면 모든 매장 합계, 매장이면 그 매장 */
export const mineOf = (row: StoreStockRow, view: StoreView | '') =>
  view === 'all' ? row.store_total : (view ? row.stores[view] || 0 : 0);

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
export function stockTierOf(row: StoreStockRow, storeKey: StoreView): StockTier {
  const mine = mineOf(row, storeKey);
  if (mine > 0) return 0;
  if (row.store_total - mine > 0) return 1;
  if (row.hq_available + row.hq_bonded + row.incoming + row.arrival_btls > 0) return 2;
  return 3;
}

/** 구역 순 안정 정렬 — 같은 구역 안에서는 기존(검색 관련도) 순서 유지 */
export function sortByTier(rows: StoreStockRow[], storeKey: StoreView): StoreStockRow[] {
  return rows.map((r, i) => ({ r, i, t: stockTierOf(r, storeKey) }))
    .sort((a, b) => a.t - b.t || a.i - b.i)
    .map((x) => x.r);
}

/** 입항일 표시 — 날짜가 지났는데 아직 가용재고 전이면:
 *  보세에 들어와 있으면 'customs'(통관 중), 보세에도 없으면 'late'(지연 — 미착 리스트 갱신이 늦거나 배가 늦음).
 *  재고 행·상세·입고 알림 목록 공용. today는 KST YYYY-MM-DD. */
export function arrivalLabel(date: string, today: string, bonded = 0): { md: string; state: 'upcoming' | 'customs' | 'late' } {
  const md = `${date.slice(5, 7)}/${date.slice(8, 10)}`;
  if (date >= today) return { md, state: 'upcoming' };
  return { md, state: bonded > 0 ? 'customs' : 'late' };
}

/** 재고 목록 정렬 — 검색 결과·메뉴 목록 공용. 'default' = 매장 재고 있는 것 먼저 + 검색 관련도.
 *  같은 기준을 다시 누르면 방향(asc/desc)이 바뀐다. 기본 방향은 SORT_DEFAULT_DIR. */
export type SortKey = 'default' | 'vintage' | 'store' | 'hq' | 'name' | 'price';
export type SortDir = 'asc' | 'desc';
export type SortState = { key: SortKey; dir: SortDir };
export const SORT_LABEL: Record<SortKey, string> = {
  default: '기본', vintage: '빈티지', store: '매장 재고', hq: '본사 재고', name: '이름', price: '가격',
};
export const SORT_DEFAULT_DIR: Record<SortKey, SortDir> = {
  default: 'desc', vintage: 'desc', store: 'desc', hq: 'desc', name: 'asc', price: 'asc',
};
export function sortRows(rows: StoreStockRow[], view: StoreView, sort: SortState): StoreStockRow[] {
  if (sort.key === 'default') return sortByTier(rows, view);
  const price = (r: StoreStockRow) => r.sale_price || r.retail_price;
  const vin = (r: StoreStockRow) => (r.vintage && /^\d{4}$/.test(r.vintage) ? Number(r.vintage) : null); // NV·없음
  const val: Record<Exclude<SortKey, 'default' | 'name'>, (r: StoreStockRow) => number | null> = {
    vintage: vin, store: (r) => mineOf(r, view), hq: (r) => r.hq_available, price: (r) => (price(r) > 0 ? price(r) : null),
  };
  const sign = sort.dir === 'asc' ? 1 : -1;
  // 더미·키트·쇼핑백류(판매용 아님)는 어떤 정렬이든 맨 뒤 — 기본 정렬과 같은 규칙
  const junk = (r: StoreStockRow) => Number(/더미|키트|쇼핑백|에어팩/.test(r.item_name));
  const cmp = (a: StoreStockRow, b: StoreStockRow) => {
    if (junk(a) !== junk(b)) return junk(a) - junk(b);
    if (sort.key === 'name') return sign * a.item_name.localeCompare(b.item_name, 'ko');
    const x = val[sort.key](a); const y = val[sort.key](b);
    if (x == null || y == null) return Number(x == null) - Number(y == null); // 값 없는 것(NV·가격 없음)은 방향과 무관하게 맨 뒤
    return sign * (x - y);
  };
  return rows.map((r, i) => ({ r, i })).sort((a, b) => cmp(a.r, b.r) || a.i - b.i).map((x) => x.r);
}
