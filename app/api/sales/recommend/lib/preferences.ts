import { extractGrapesFromName, extractTypeFromName } from './patterns';
import type { ClientPreferences, PurchaseAggEntry } from './types';
import type { RegionHierarchy } from './regions';
import { normalizeType, type TypeBucket } from './wineType';
import { geoGroup, type RegionProfile } from './geoTier';
import { extractFlavorKeys } from './flavor';

/** 가격 밴드 기준 평균: 타입+지역 → 타입 → 전체 순으로 폴백(데이터 빈약 대비). */
export function priceRef(prefs: ClientPreferences, bucket: TypeBucket, group: string): number {
  const ps = prefs.priceStats;
  const tryKey = (k: string) => (ps[k] && ps[k].count >= 2 ? ps[k].sum / ps[k].count : 0);
  return tryKey(`${bucket}|${group}`) || tryKey(bucket) || tryKey('__all__') || prefs.clientAvgPrice;
}

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
  // 규칙기반 추천용 누적
  const typeBuckets = new Set<TypeBucket>();
  const regionProfile: RegionProfile = { subs: new Set(), majors: new Set(), supers: new Set() };
  const priceStats: Record<string, { sum: number; count: number }> = {};
  const flavorKeys = new Set<string>();
  const grapeKeys = new Set<string>();
  const addPrice = (key: string, price: number) => {
    if (price <= 0) return;
    const s = priceStats[key] || (priceStats[key] = { sum: 0, count: 0 });
    s.sum += price; s.count++;
  };

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
      if (h.sub_region) { subRegionBuyCount[h.sub_region] = (subRegionBuyCount[h.sub_region] || 0) + agg.count; regionProfile.subs.add(h.sub_region); }
      if (h.major_region) { majorRegionBuyCount[h.major_region] = (majorRegionBuyCount[h.major_region] || 0) + agg.count; regionProfile.majors.add(h.major_region); }
      if (h.super_region) { superRegionBuyCount[h.super_region] = (superRegionBuyCount[h.super_region] || 0) + agg.count; regionProfile.supers.add(h.super_region); }
    }

    // 타입 버킷 + 타입×지역 가격 통계
    const bucket = normalizeType(wine?.wine_type || '', wine?.item_name_kr || inv?.item_name || agg.name);
    if (bucket) {
      typeBuckets.add(bucket);
      const group = geoGroup(h);
      addPrice('__all__', avgPrice);
      addPrice(bucket, avgPrice);
      if (group) addPrice(`${bucket}|${group}`, avgPrice);
    } else {
      addPrice('__all__', avgPrice);
    }
    // 향미 키(테이스팅노트)
    for (const k of extractFlavorKeys(wine?._notes || '')) flavorKeys.add(k);

    // 품종
    let grapeStr = wine?.grape_varieties || '';
    if (!grapeStr && (inv?.item_name || agg.name)) {
      const extracted = extractGrapesFromName(inv?.item_name || agg.name);
      if (extracted.length > 0) grapeStr = extracted.join(', ');
    }
    if (grapeStr) {
      const grapes = grapeStr.split(/[,\/]/).map((g: string) => g.trim()).filter(Boolean);
      for (const g of grapes) { grapeBuyCount[g] = (grapeBuyCount[g] || 0) + agg.count; grapeKeys.add(g.toLowerCase()); }
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
    typeBuckets,
    regionProfile,
    priceStats,
    flavorKeys,
    grapeKeys,
  };
}
