import { extractGrapesFromName, extractTypeFromName } from './patterns';
import type { ClientAnalysis } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Shipment = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WineMeta = Map<string, any>;

/**
 * 거래처 shipments → 구매 통계 (country/grape/type 빈도 + 매출 + 트렌드).
 * 최근 3개월 vs 이전 3개월로 trend 판정.
 */
export function analyzeClientHistory(
  shipments: Shipment[],
  wineMap: WineMeta,
  now: Date,
): ClientAnalysis {
  const currentYear = now.getFullYear().toString();
  const threeMonthsAgo = new Date(now); threeMonthsAgo.setMonth(now.getMonth() - 3);
  const sixMonthsAgo = new Date(now); sixMonthsAgo.setMonth(now.getMonth() - 6);
  const threeStr = threeMonthsAgo.toISOString().slice(0, 10);
  const sixStr = sixMonthsAgo.toISOString().slice(0, 10);

  let totalPurchases = 0;
  const priceList: number[] = [];
  const countryCount: Record<string, number> = {};
  const grapeCount: Record<string, number> = {};
  const typeCount: Record<string, number> = {};
  let lastOrderDate: string | null = null;
  let yearlyRevenue = 0;
  let recentQtr = 0;
  let prevQtr = 0;

  const purchaseAgg: ClientAnalysis['purchaseAgg'] = {};

  for (const s of shipments) {
    if (!s.item_no) continue;
    totalPurchases++;
    if (s.unit_price) priceList.push(s.unit_price);
    if (s.ship_date && (!lastOrderDate || s.ship_date > lastOrderDate)) lastOrderDate = s.ship_date;

    // 올해 매출 누적
    if (s.ship_date?.toString().startsWith(currentYear)) {
      yearlyRevenue += (s.total_amount || 0);
    }

    // 분기별 매출 (trend 계산용)
    const d = s.ship_date?.toString().slice(0, 10) || '';
    const amt = s.total_amount || s.unit_price || 0;
    if (d >= threeStr) recentQtr += amt;
    else if (d >= sixStr) prevQtr += amt;

    // 품목별 집계
    if (!purchaseAgg[s.item_no]) {
      purchaseAgg[s.item_no] = { count: 0, lastDate: '', totalPrice: 0, name: s.item_name || '' };
    }
    const agg = purchaseAgg[s.item_no];
    agg.count++;
    if (s.ship_date && s.ship_date > agg.lastDate) agg.lastDate = s.ship_date;
    if (s.unit_price) agg.totalPrice += s.unit_price;

    const wine = wineMap.get(s.item_no);
    const itemCountry = wine?.country || wine?.country_en || '';
    if (itemCountry) countryCount[itemCountry] = (countryCount[itemCountry] || 0) + 1;

    // 품종
    let grapeStr = wine?.grape_varieties || '';
    if (!grapeStr && s.item_name) {
      const extracted = extractGrapesFromName(s.item_name);
      if (extracted.length > 0) grapeStr = extracted.join(', ');
    }
    if (grapeStr) {
      for (const g of grapeStr.split(/[,\/]/).map((x: string) => x.trim()).filter(Boolean)) {
        grapeCount[g] = (grapeCount[g] || 0) + 1;
      }
    }

    // 타입
    let itemType = wine?.wine_type || '';
    if (!itemType && s.item_name) itemType = extractTypeFromName(s.item_name);
    if (itemType) typeCount[itemType] = (typeCount[itemType] || 0) + 1;
  }

  const avgPrice = priceList.length > 0
    ? Math.round(priceList.reduce((a, b) => a + b, 0) / priceList.length)
    : 0;
  const topCountries = Object.entries(countryCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map((e) => e[0]);
  const topGrapes = Object.entries(grapeCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map((e) => e[0]);
  const topTypes = Object.entries(typeCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map((e) => e[0]);

  const trend: 'up' | 'down' | 'stable' =
    prevQtr > 0
      ? (recentQtr > prevQtr ? 'up' : recentQtr < prevQtr ? 'down' : 'stable')
      : (recentQtr > 0 ? 'up' : 'stable');

  return {
    totalPurchases,
    purchaseAgg,
    avgPrice,
    countryCount, grapeCount, typeCount,
    topCountries, topGrapes, topTypes,
    lastOrderDate,
    yearlyRevenue,
    trend,
    recentQtr, prevQtr,
  };
}
