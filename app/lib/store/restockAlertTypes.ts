// 입고 알림 타입 (클라이언트 안전 — 서버 모듈 import 금지)
export type RestockAlert = {
  id: number;
  created_at: string;
  store_key: string;
  item_no: string;
  item_name: string;
  status: 'waiting' | 'arrived' | 'done';
  arrived_at: string | null;
  done_at: string | null;
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  eta: string | null; // 입고(입항) 예정일 YYYY-MM-DD — 일정 없으면 null
  bonded: number;     // 보세 재고(통관 전) — 입항일 지났을 때 '통관 중'/'지연' 구분
  incoming_btls: number; // 들어오는 병수 (입항 일정 수량, 없으면 미착 수량)
};
