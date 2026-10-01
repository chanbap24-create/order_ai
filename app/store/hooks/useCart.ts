'use client';

// 정산 카트 — 매장에서 손님 구매 와인을 담아 판매가(백화점가) 합계를 내는 용도.
// 세션 저장(sessionStorage) — 앱을 닫으면 비워진다. 손님 간 이월 방지. 서버 기록 없음.
import { useEffect, useState } from 'react';
import { CART_KEY as LS_CART, EXTRA_RATE_KEY as LS_EXTRA, EXTRA_WON_KEY as LS_EXTRA_WON, type CartItem } from '@/app/lib/store/cartSession';

/** 담기에 필요한 최소 필드 — StoreStockRow·SommelierResult 변환값 모두 수용 */
type AddInput = { item_no: string; item_name: string; sale_price: number; retail_price: number };

export type { CartItem } from '@/app/lib/store/cartSession';

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [extraRate, setExtraRateState] = useState(0); // 추가 할인율 %
  const [extraWon, setExtraWonState] = useState(0);   // 추가 할인 금액(원) — %와 택일

  useEffect(() => {
    // setTimeout 0 — effect 내 동기 setState 캐스케이드 방지 (react-compiler 규칙)
    const t = setTimeout(() => {
      try {
        setItems(JSON.parse(sessionStorage.getItem(LS_CART) || '[]'));
        setExtraRateState(Math.min(50, Math.max(0, Number(sessionStorage.getItem(LS_EXTRA)) || 0)));
        setExtraWonState(Math.max(0, Number(sessionStorage.getItem(LS_EXTRA_WON)) || 0));
      } catch { /* ignore */ }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const setExtraRate = (pct: number) => {
    const v = Math.min(50, Math.max(0, Math.round(pct) || 0));
    setExtraRateState(v);
    if (v > 0) setExtraWonState(0); // %와 금액은 택일
    try {
      sessionStorage.setItem(LS_EXTRA, String(v));
      if (v > 0) sessionStorage.setItem(LS_EXTRA_WON, '0');
    } catch { /* ignore */ }
  };

  const setExtraWon = (won: number) => {
    const v = Math.max(0, Math.round(won) || 0);
    setExtraWonState(v);
    if (v > 0) setExtraRateState(0);
    try {
      sessionStorage.setItem(LS_EXTRA_WON, String(v));
      if (v > 0) sessionStorage.setItem(LS_EXTRA, '0');
    } catch { /* ignore */ }
  };

  const persist = (next: CartItem[]) => {
    setItems(next);
    try { sessionStorage.setItem(LS_CART, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const add = (row: AddInput) => {
    const found = items.find((i) => i.item_no === row.item_no);
    persist(found
      ? items.map((i) => (i.item_no === row.item_no ? { ...i, qty: i.qty + 1 } : i))
      : [...items, {
          item_no: row.item_no, item_name: row.item_name, qty: 1,
          sale_price: row.sale_price || row.retail_price, retail_price: row.retail_price,
        }]);
  };

  const setQty = (itemNo: string, qty: number) => {
    persist(qty <= 0 ? items.filter((i) => i.item_no !== itemNo)
      : items.map((i) => (i.item_no === itemNo ? { ...i, qty } : i)));
  };

  const clear = () => { persist([]); setExtraRate(0); setExtraWon(0); };

  const bottles = items.reduce((s, i) => s + i.qty, 0);
  const total = items.reduce((s, i) => s + i.sale_price * i.qty, 0);
  const retailTotal = items.reduce((s, i) => s + i.retail_price * i.qty, 0);
  // 추가 할인 — 금액 입력이 있으면 그대로(합계 한도), 아니면 %를 할인가 합계에 적용(100원 단위 내림)
  const extraAmount = extraWon > 0 ? Math.min(extraWon, total) : Math.floor((total * extraRate) / 100 / 100) * 100;
  const finalTotal = total - extraAmount;

  return {
    items, add, setQty, clear, bottles, total, retailTotal,
    extraRate, setExtraRate, extraWon, setExtraWon, extraAmount, finalTotal,
  };
}
