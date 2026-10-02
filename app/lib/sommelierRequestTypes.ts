// 소믈리에 수정 요청 공용 상수·타입 — 클라이언트에서도 임포트하므로 서버 모듈(db 등) 금지.

export const REQUEST_CATEGORIES = {
  note: '테이스팅 노트 요청',
  image: '이미지 변경 요청',
  price_stock: '판매가 및 재고 확인',
  other: '기타',
} as const;
export type RequestCategory = keyof typeof REQUEST_CATEGORIES;

export type ChangeRequest = {
  id: number;
  created_at: string;
  item_no: string;
  item_name_kr: string | null;
  item_name_en: string | null;
  category: RequestCategory;
  message: string | null;
  store_key: string | null;
  requester: string;
  status: 'open' | 'done';
  resolved_at: string | null;
  resolved_by: string | null;
};
