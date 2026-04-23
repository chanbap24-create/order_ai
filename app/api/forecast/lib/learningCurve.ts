import type { LearningCurve } from "./types";

/**
 * 러닝커브 계산
 * 24개월+ 이력이 있는 와인의 1년차 vs 2년차+ 판매 비율
 */
export function calcLearningCurve(
  shipments: { ship_date: string; quantity: number; item_no: string }[],
  getWineName: (itemNo: string) => string,
): LearningCurve {
  const wineShips: Record<string, { date: string; qty: number }[]> = {};

  for (const s of shipments) {
    if (!s.ship_date || (s.quantity || 0) <= 0) continue;
    const name = getWineName(s.item_no);
    if (!wineShips[name]) wineShips[name] = [];
    wineShips[name].push({ date: s.ship_date, qty: s.quantity });
  }

  const details: { name: string; year1: number; mature: number; ratio: number }[] = [];

  for (const [name, ships] of Object.entries(wineShips)) {
    ships.sort((a, b) => a.date.localeCompare(b.date));
    const firstDate = new Date(ships[0].date);
    const lastDate = new Date(ships[ships.length - 1].date);

    const monthsSpan = (lastDate.getFullYear() - firstDate.getFullYear()) * 12 +
      (lastDate.getMonth() - firstDate.getMonth());
    if (monthsSpan < 23) continue;

    // 1년차 경계
    const year1End = new Date(firstDate);
    year1End.setFullYear(year1End.getFullYear() + 1);
    const year1EndStr = year1End.toISOString().substring(0, 10);

    let year1Qty = 0;
    let matureQty = 0;
    for (const s of ships) {
      if (s.date < year1EndStr) year1Qty += s.qty;
      else matureQty += s.qty;
    }

    // 2년차+ 기간 (월 단위)
    const matureMonths = (lastDate.getFullYear() - year1End.getFullYear()) * 12 +
      (lastDate.getMonth() - year1End.getMonth()) + 1;
    if (matureMonths < 12) continue;

    const matureAnnual = Math.round(matureQty / matureMonths * 12);
    if (matureAnnual < 12) continue;

    // 프로모션 론칭 등 1년차 > 2년차+인 경우 제외
    if (year1Qty > matureAnnual * 1.2) continue;

    const ratio = Math.round(year1Qty / matureAnnual * 100) / 100;
    if (ratio > 0 && ratio <= 1.0) {
      details.push({ name, year1: year1Qty, mature: matureAnnual, ratio });
    }
  }

  if (details.length === 0) {
    return { ratio: 0.7, sampleSize: 0, details: [] };
  }

  const avgRatio = Math.round(details.reduce((s, d) => s + d.ratio, 0) / details.length * 100) / 100;

  return {
    ratio: avgRatio,
    sampleSize: details.length,
    details: details.sort((a, b) => a.ratio - b.ratio),
  };
}
