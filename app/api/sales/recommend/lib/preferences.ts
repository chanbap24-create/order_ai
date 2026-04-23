import { extractGrapesFromName, extractTypeFromName } from './patterns';
import type { ClientPreferences, PurchaseAggEntry } from './types';
import type { RegionHierarchy } from './regions';

type ShipmentRow = { item_no?: string; item_name?: string; unit_price?: number | null; ship_date?: string | null };

/**
 * shipments → purchaseAgg 집계.
 */
export function aggregatePurchases(shipments: ShipmentRow[] | null): Record<string, PurchaseAggEntry> {
  const purchaseAgg: Record<string, PurchaseAggEntry> = {};
  for (const s of shipments || []) {
    if (!s.item_no) continue;
    if (!purchaseAgg[s.item_no]) {
      purchaseAgg[s.item_no] = { count: 0, lastDate: '', totalPrice: 0, name: s.item_name || '' };
    }
    const agg = purchaseAgg[s.item_no];
    agg.count++;
    if (s.ship_date && s.ship_date > agg.lastDate) agg.lastDate = s.ship_date;
    if (s.unit_price) agg.totalPrice += s.unit_price;
  }
  return purchaseAgg;
}

/**
 * purchaseAgg + wineMap + inventoryMap에서 거래처 선호도 계산.
 */
export function buildClientPreferences(
  purchaseAgg: Record<string, PurchaseAggEntry>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wineMap: Map<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inventoryMap: Map<string, any>,
): ClientPreferences {
  const countryBuyCount: Record<string, number> = {};
  const grapeBuyCount: Record<string, number> = {};
  const typeBuyCount: Record<string, number> = {};
  const subRegionBuyCount: Record<string, number> = {};
  const majorRegionBuyCount: Record<string, number> = {};
  const superRegionBuyCount: Record<string, number> = {};

  let totalPurchases = 0;
  const priceList: number[] = [];

  for (const [itemNo, agg] of Object.entries(purchaseAgg)) {
    totalPurchases += agg.count;
    const avgPrice = agg.totalPrice / agg.count;
    if (avgPrice > 0) priceList.push(avgPrice);

    const wine = wineMap.get(itemNo);
    const inv = inventoryMap.get(itemNo);
    const country = wine?.country || wine?.country_en || inv?.country || '';
    if (country) countryBuyCount[country] = (countryBuyCount[country] || 0) + agg.count;

    const h: RegionHierarchy | null = wine?._hierarchy || null;
    if (h) {
      if (h.sub_region) subRegionBuyCount[h.sub_region] = (subRegionBuyCount[h.sub_region] || 0) + agg.count;
      if (h.major_region) majorRegionBuyCount[h.major_region] = (majorRegionBuyCount[h.major_region] || 0) + agg.count;
      if (h.super_region) superRegionBuyCount[h.super_region] = (superRegionBuyCount[h.super_region] || 0) + agg.count;
    }

    // 품종
    let grapeStr = wine?.grape_varieties || '';
    if (!grapeStr && (inv?.item_name || agg.name)) {
      const extracted = extractGrapesFromName(inv?.item_name || agg.name);
      if (extracted.length > 0) grapeStr = extracted.join(', ');
    }
    if (grapeStr) {
      const grapes = grapeStr.split(/[,\/]/).map((g: string) => g.trim()).filter(Boolean);
      for (const g of grapes) grapeBuyCount[g] = (grapeBuyCount[g] || 0) + agg.count;
    }

    // 와인 타입
    let wt = wine?.wine_type || '';
    if (!wt && (inv?.item_name || agg.name)) {
      wt = extractTypeFromName(inv?.item_name || agg.name);
    }
    if (wt) {
      wt = wt.trim();
      if (wt) typeBuyCount[wt] = (typeBuyCount[wt] || 0) + agg.count;
    }
  }

  const clientAvgPrice = priceList.length > 0
    ? priceList.reduce((a, b) => a + b, 0) / priceList.length : 0;

  const topCountries = Object.entries(countryBuyCount).sort((a, b) => b[1] - a[1]);
  const topGrapes = Object.entries(grapeBuyCount).sort((a, b) => b[1] - a[1]);
  const topTypes = Object.entries(typeBuyCount).sort((a, b) => b[1] - a[1]);

  return {
    countryBuyCount, grapeBuyCount, typeBuyCount,
    subRegionBuyCount, majorRegionBuyCount, superRegionBuyCount,
    totalPurchases,
    clientAvgPrice,
    topCountries, topGrapes, topTypes,
    maxCountryBuy: topCountries[0]?.[1] || 1,
    maxGrapeBuy: topGrapes[0]?.[1] || 1,
    maxTypeBuy: topTypes[0]?.[1] || 1,
    maxSubRegionBuy: Math.max(...Object.values(subRegionBuyCount), 1),
    maxMajorRegionBuy: Math.max(...Object.values(majorRegionBuyCount), 1),
    maxSuperRegionBuy: Math.max(...Object.values(superRegionBuyCount), 1),
    hasRegionPrefs: Object.keys(subRegionBuyCount).length > 0,
    hasHistory: totalPurchases > 0,
  };
}
