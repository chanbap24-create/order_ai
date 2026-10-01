// 점장 매장 앱 공용 상수·타입 — 클라이언트에서도 임포트하므로 서버 모듈(db 등) 금지.

/** CDV 백화점 매장 — inventory_cdv 컬럼 키와 라벨 (화면 순서) */
export const STORES = [
  { key: 'store_thehyundai', label: '더현대서울' },
  { key: 'store_ssg_gangnam', label: '신세계강남' },
  { key: 'store_hyundai_main', label: '현대본점' },
  { key: 'store_hyundai_trade', label: '현대무역' },
  { key: 'store_hyundai_jungdong', label: '현대중동' },
] as const;
export type StoreKey = (typeof STORES)[number]['key'];

export type StoreStockRow = {
  item_no: string;
  item_name: string;
  vintage: string | null;
  retail_price: number;       // 정상 판매가
  sale_price: number;         // 백화점 할인가 (소믈리에 밴드)
  discount_rate: number;
  hq_available: number;       // 본사 가용
  hq_bonded: number;          // 보세 (통관 전)
  incoming: number;           // 입고 예정 수량(재고표)
  arrival_date: string | null; // 다음 입항일 (스케줄)
  arrival_btls: number;
  stores: Record<StoreKey, number>;
  store_total: number;        // 전 매장 합
};
