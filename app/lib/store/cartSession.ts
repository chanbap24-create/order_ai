'use client';

// 정산 카트 세션 저장 공용 모듈 — /store(useCart)와 소믈리에 결과 화면이 같은 카트를 쓴다.
// sessionStorage: 앱을 닫으면 비워짐. 서버 기록 없음.

export type CartItem = {
  item_no: string;
  item_name: string;
  qty: number;
  sale_price: number;   // 적용 판매가 (백화점 할인가)
  retail_price: number; // 정상가
};

export const CART_KEY = 'cave_store_cart';
export const EXTRA_RATE_KEY = 'cave_store_extra_rate';
export const EXTRA_WON_KEY = 'cave_store_extra_won';

export function readCart(): CartItem[] {
  try { return JSON.parse(sessionStorage.getItem(CART_KEY) || '[]'); } catch { return []; }
}

export function writeCart(items: CartItem[]) {
  try { sessionStorage.setItem(CART_KEY, JSON.stringify(items)); } catch { /* ignore */ }
}

/** 한 병 담기 — 이미 있으면 수량 +1. 갱신된 카트를 돌려준다. */
export function addToCart(item: Omit<CartItem, 'qty'>): CartItem[] {
  const items = readCart();
  const found = items.find((i) => i.item_no === item.item_no);
  const next = found
    ? items.map((i) => (i.item_no === item.item_no ? { ...i, qty: i.qty + 1 } : i))
    : [...items, { ...item, qty: 1 }];
  writeCart(next);
  return next;
}
