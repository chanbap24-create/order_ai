import type { Candidate, OrderLine } from "../types";

/** OrderLine의 선택된 후보 반환 (없으면 null) */
export function getSelected(ol: OrderLine): Candidate | null {
  if (ol.selectedIdx < 0 || ol.selectedIdx >= ol.candidates.length) return null;
  return ol.candidates[ol.selectedIdx];
}

/**
 * 할인율을 적용한 단가 (반올림).
 * discountRate는 0~100 퍼센트.
 */
export function applyDiscount(supplyPrice: number, discountRate: number): number {
  return Math.round(supplyPrice * (1 - discountRate / 100));
}

/** 특정 라인의 할인 적용가 */
export function getItemPrice(
  orderLines: OrderLine[],
  discountRates: Record<number, number>,
  idx: number,
): number {
  const sel = getSelected(orderLines[idx]);
  if (!sel) return 0;
  const rate = discountRates[idx] || 0;
  return applyDiscount(sel.supply_price, rate);
}

/** 전체 주문 합계 */
export function calcTotalAmount(
  orderLines: OrderLine[],
  discountRates: Record<number, number>,
): number {
  return orderLines.reduce(
    (sum, ol, idx) => sum + getItemPrice(orderLines, discountRates, idx) * ol.quantity,
    0,
  );
}
