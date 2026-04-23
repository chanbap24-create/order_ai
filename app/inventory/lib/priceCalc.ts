import type { QuoteItem } from "../types";

/**
 * 할인가 계산.
 * - storedPrice가 유효하면 그것을 사용 (사용자 수동 입력 우선)
 * - 아니면 supply_price × (1 - discount_rate) 반올림
 */
export function calcDiscountedPrice(
  price: number,
  rate: number,
  storedPrice?: number,
): number {
  if (storedPrice && storedPrice > 0) return storedPrice;
  return Math.round(price * (1 - rate));
}

/** 견적 합계 계산 (정상/할인/최저/판매정상/판매할인) */
export function calcQuoteTotals(items: QuoteItem[]) {
  let normalTotal = 0;
  let discountTotal = 0;
  let minPriceTotal = 0;
  let retailNormalTotal = 0;
  let retailDiscountTotal = 0;

  for (const it of items) {
    const qty = it.quantity || 0;
    const discPrice = calcDiscountedPrice(
      it.supply_price,
      it.discount_rate,
      it.discounted_price,
    );
    normalTotal += (it.supply_price || 0) * qty;
    discountTotal += discPrice * qty;
    minPriceTotal += (it.min_price || 0) * qty;
    retailNormalTotal += (it.retail_price || 0) * qty;
    retailDiscountTotal += discPrice * qty; // UI에서 retailDiscountedPrice 적용 시 대체 필요
  }

  return {
    normalTotal,
    discountTotal,
    minPriceTotal,
    retailNormalTotal,
    retailDiscountTotal,
  };
}
