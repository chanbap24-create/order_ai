'use client';

// 정산 카트 세션 저장 공용 모듈 — /store(useCart)와 소믈리에 결과 화면이 같은 카트를 쓴다.
// sessionStorage: 앱을 닫으면 비워짐. 서버 기록 없음.

export type CartItem = {
  item_no: string;
  item_name: string;
  qty: number;
  sale_price: number;   // 적용 판매가 (백화점 할인가)
  retail_price: number; // 정상가
  source?: 'quiz' | 'stock'; // 어디서 담았나 — 추천 문답 결과 / 재고에서 직접 (구매 기록·취향 학습용)
  rec_rank?: number | null;  // 추천 결과 순위(문답에서 담았을 때)
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

// ── 손님 연결 — 정산·구매 기록의 귀속 대상. 카트와 같이 세션 단위(앱 닫으면 해제) ──
export type Guest = { id: number; name: string };
const GUEST_KEY = 'cave_store_customer';
const QUIZ_SESSION_KEY = 'cave_store_quiz_session'; // 이 손님의 직전 문답 세션 id — 구매 기록에 연결

export function readQuizSession(): number | null {
  try { return Number(sessionStorage.getItem(QUIZ_SESSION_KEY)) || null; } catch { return null; }
}
export function writeQuizSession(id: number | null) {
  try {
    if (id) sessionStorage.setItem(QUIZ_SESSION_KEY, String(id));
    else sessionStorage.removeItem(QUIZ_SESSION_KEY);
  } catch { /* ignore */ }
}

export function readGuest(): Guest | null {
  try {
    const g = JSON.parse(sessionStorage.getItem(GUEST_KEY) || 'null') as Guest | null;
    return g?.id ? g : null;
  } catch { return null; }
}

/** 새 손님 응대 시작 — 이전 손님의 카트·추가할인을 비우고 손님을 교체(null=익명/미동의). */
export function startGuestSession(guest: Guest | null) {
  try {
    sessionStorage.removeItem(CART_KEY);
    sessionStorage.removeItem(EXTRA_RATE_KEY);
    sessionStorage.removeItem(EXTRA_WON_KEY);
    sessionStorage.removeItem(QUIZ_SESSION_KEY);
    if (guest) sessionStorage.setItem(GUEST_KEY, JSON.stringify(guest));
    else sessionStorage.removeItem(GUEST_KEY);
    localStorage.removeItem(GUEST_KEY); // 구버전(localStorage) 잔존 정리
  } catch { /* ignore */ }
}

/** 응대 종료 — 손님 연결·카트 모두 해제 */
export const endGuestSession = () => startGuestSession(null);

/** 같은 손님 응대 중 손님 정보만 동기화(카트 유지) — 추천↔재고 왕복용 */
export function syncGuest(guest: Guest | null) {
  try {
    if (guest) sessionStorage.setItem(GUEST_KEY, JSON.stringify(guest));
  } catch { /* ignore */ }
}
