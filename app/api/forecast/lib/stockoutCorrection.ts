import type { StockoutCorrection } from "./types";

/**
 * 재고 소진 보정 계산
 * 와인명 기준 월별 출고 패턴에서 2개월+ 공백 후 재개된 구간을 품절로 판정
 */
export function calcStockoutCorrections(
  shipments: { ship_date: string; quantity: number; item_no: string }[],
  getWineName: (itemNo: string) => string,
): Record<string, StockoutCorrection> {
  const wineMonthly: Record<string, Record<string, number>> = {};

  for (const s of shipments) {
    const ym = s.ship_date?.substring(0, 7);
    if (!ym || (s.quantity || 0) <= 0) continue;
    const name = getWineName(s.item_no);
    if (!wineMonthly[name]) wineMonthly[name] = {};
    wineMonthly[name][ym] = (wineMonthly[name][ym] || 0) + s.quantity;
  }

  const result: Record<string, StockoutCorrection> = {};

  for (const [name, monthly] of Object.entries(wineMonthly)) {
    const months = Object.keys(monthly).sort();
    if (months.length < 3) {
      result[name] = { factor: 1, activeMonths: months.length, totalMonths: months.length, stockoutMonths: 0 };
      continue;
    }

    const first = months[0];
    const last = months[months.length - 1];
    const [fy, fm] = first.split('-').map(Number);
    const [ly, lm] = last.split('-').map(Number);
    const totalMonths = (ly - fy) * 12 + (lm - fm) + 1;
    const activeMonths = months.length;

    if (totalMonths - activeMonths < 2 || totalMonths < 6) {
      result[name] = { factor: 1, activeMonths, totalMonths, stockoutMonths: 0 };
      continue;
    }

    // 공백 전후 판매 존재 확인 → 재고 소진 판정
    const monthSet = new Set(months);
    let stockoutMonths = 0;
    let consecutiveGap = 0;
    let consecutiveSales = 0;
    let hadSustainedSales = false;
    const current = new Date(fy, fm - 1);
    const lastDate = new Date(ly, lm - 1);

    while (current <= lastDate) {
      const ym = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
      if (monthSet.has(ym)) {
        if (consecutiveGap >= 2 && hadSustainedSales) {
          stockoutMonths += consecutiveGap;
        }
        consecutiveGap = 0;
        consecutiveSales++;
        if (consecutiveSales >= 2) hadSustainedSales = true;
      } else {
        consecutiveGap++;
        consecutiveSales = 0;
      }
      current.setMonth(current.getMonth() + 1);
    }

    if (stockoutMonths === 0) {
      result[name] = { factor: 1, activeMonths, totalMonths, stockoutMonths: 0 };
      continue;
    }

    const effectiveMonths = totalMonths - stockoutMonths;
    const rawFactor = totalMonths / effectiveMonths;
    const factor = Math.min(Math.round(rawFactor * 100) / 100, 2.0);

    result[name] = { factor, activeMonths, totalMonths, stockoutMonths };
  }

  return result;
}
