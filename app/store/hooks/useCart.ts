'use client';

// 정산 카트 — 매장에서 손님 구매 와인을 담아 판매가(백화점가) 합계를 내는 용도.
// 기기 로컬에만 저장(cave_store_cart), 서버 기록 없음.
import { useEffect, useState } from 'react';
import type { StoreStockRow } from '@/app/lib/store/types';

export type CartItem = {
  item_no: string;
  item_name: string;
  qty: number;
  sale_price: number;   // 적용 판매가 (백화점 할인가)
  retail_price: number; // 정상가
};

const LS_CART = 'cave_store_cart';

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    // setTimeout 0 — effect 내 동기 setState 캐스케이드 방지 (react-compiler 규칙)
    const t = setTimeout(() => {
      try { setItems(JSON.parse(localStorage.getItem(LS_CART) || '[]')); } catch { /* ignore */ }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const persist = (next: CartItem[]) => {
    setItems(next);
    try { localStorage.setItem(LS_CART, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const add = (row: StoreStockRow) => {
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

  const clear = () => persist([]);

  const bottles = items.reduce((s, i) => s + i.qty, 0);
  const total = items.reduce((s, i) => s + i.sale_price * i.qty, 0);
  const retailTotal = items.reduce((s, i) => s + i.retail_price * i.qty, 0);

  return { items, add, setQty, clear, bottles, total, retailTotal };
}
