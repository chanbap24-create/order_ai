import { extractGrapesFromName, extractTypeFromName } from './patterns';
import type { ClientPreferences, PurchaseAggEntry } from './types';
import type { RegionHierarchy } from './regions';
import { normalizeType, type TypeBucket } from './wineType';
import { geoGroup, type RegionProfile } from './geoTier';
import { extractFlavorKeys } from './flavor';

/** 표시/참고용 대표가 = 타입별 횟수 가중 평균(폴백: 타입+지역→타입→전체→단순평균). */
export function priceRef(prefs: ClientPreferences, bucket: TypeBucket, group: string): number {
  const ps = prefs.priceStats;
  const tryKey = (k: string) => (ps[k] && ps[k].n >= 2 ? ps[k].mean : 0);
  return tryKey(`${bucket}|${group}`) || tryKey(bucket) || tryKey('__all__') || prefs.clientAvgPrice;
}

/** 가격 하한 = 그 '타입' 실제 구매가 p10(자주 사는 저가 봉우리 포함). 타입별. */
export function priceFloor(prefs: ClientPreferences, bucket: TypeBucket, group: string): number {
  const ps = prefs.priceStats;
  const tryKey = (k: string) => (ps[k] && ps[k].n >= 1 ? ps[k].lo : 0);
  return tryKey(bucket) || tryKey(`${bucket}|${group}`) || tryKey('__all__') || 0;
}

/** 가격 상한 = 그 '타입' 실제 구매가 p90(비싼 봉우리 포함). 타입별로 잡아 다른 타입 초고가가 안 새어들게. */
export function priceCeil(prefs: ClientPreferences, bucket: TypeBucket, group: string): number {
  const ps = prefs.priceStats;
  const tryKey = (k: string) => (ps[k] && ps[k].n >= 1 ? ps[k].hi : 0);
  return tryKey(bucket) || tryKey(`${bucket}|${group}`) || tryKey('__all__') || 0;
}

const MIN_CREDIBLE_PRICE = 3000; // 이 미만 unit_price는 와인가 아님(글라스/샘플/구포맷 오염) → 밴드에서 제외

/** 횟수(w) 가중 q-분위수. q=0.1/0.9로 강건한 [lo,hi] 범위 산출(단발 극단 방어). */
function weightedQuantile(samples: Array<{ p: number; w: number }>, q: number): number {
  if (!samples.length) return 0;
  const sorted = [...samples].sort((a, b) => a.p - b.p);
  const total = sorted.reduce((s, x) => s + x.w, 0);
  const target = total * q;
  let cum = 0;
  for (const s of sorted) { cum += s.w; if (cum >= target) return s.p; }
  return sorted[sorted.length - 1].p;
}

type ShipmentRow = { item_no?: string; item_name?: string; unit_price?: number | null; quantity?: number | null; ship_date?: string | null };

/**
 * shipments → purchaseAgg 집계.
 * count=출고 행 수(재주문 판정용), qty=병수, spend=매입액(병수×단가, 선호 가중치 기준).
 */
export function aggregatePurchases(shipments: ShipmentRow[] | null): Record<string, PurchaseAggEntry> {
  const purchaseAgg: Record<string, PurchaseAggEntry> = {};
  for (const s of shipments || []) {
    if (!s.item_no) continue;
    if (!purchaseAgg[s.item_no]) {
      purchaseAgg[s.item_no] = { count: 0, pricedCount: 0, qty: 0, spend: 0, lastDate: '', totalPrice: 0, name: s.item_name || '' };
    }
    const agg = purchaseAgg[s.item_no];
    agg.count++;
    const qty = Number(s.quantity) || 0;
    const price = Number(s.unit_price) || 0;
    if (qty > 0) agg.qty += qty;
    if (qty > 0 && price > 0) agg.spend += qty * price;
    if (s.ship_date && s.ship_date > agg.lastDate) agg.lastDate = s.ship_date;
    if (price > 0) { agg.totalPrice += price; agg.pricedCount++; } // 0원(시음주) 제외
  }
  return purchaseAgg;
}

/** 선호도 가중치: 매입액 우선, 없으면 병수, 그것도 없으면 횟수로 폴백. */
export function preferenceWeight(agg: PurchaseAggEntry): number {
  return agg.spend > 0 ? agg.spend : agg.qty > 0 ? agg.qty : agg.count;
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
  const priceSamples: Record<string, Array<{ p: number; w: number }>> = {}; // 키별 (평균단가, 구매횟수) 표본 → 후처리에서 가중 중앙값
  const flavorKeys = new Set<string>();
  const grapeKeys = new Set<string>();
  const regionDist: Record<string, number> = {};
  const addPrice = (key: string, price: number, w: number) => {
    if (price < MIN_CREDIBLE_PRICE || w <= 0) return; // 오염 저가 제외
    (priceSamples[key] || (priceSamples[key] = [])).push({ p: price, w });
  };

  for (const [itemNo, agg] of Object.entries(purchaseAgg)) {
    totalPurchases += agg.count;
    // 선호도(국가·지역·품종·타입) 가중치 = 매입액. "돈을 어디에 쓰는가"가 횟수보다 강한 신호.
    const w = preferenceWeight(agg);
    const avgPrice = agg.pricedCount > 0 ? agg.totalPrice / agg.pricedCount : 0; // 0원 시음주 제외 평균
    if (avgPrice > 0) priceList.push(avgPrice);

    const wine = wineMap.get(itemNo);
    const inv = inventoryMap.get(itemNo);
    const country = wine?.country || wine?.country_en || inv?.country || '';
    if (country) countryBuyCount[country] = (countryBuyCount[country] || 0) + w;

    const h: RegionHierarchy | null = wine?._hierarchy || null;
    if (h) {
      if (h.sub_region) { subRegionBuyCount[h.sub_region] = (subRegionBuyCount[h.sub_region] || 0) + w; regionProfile.subs.add(h.sub_region); }
      if (h.major_region) { majorRegionBuyCount[h.major_region] = (majorRegionBuyCount[h.major_region] || 0) + w; regionProfile.majors.add(h.major_region); }
      if (h.super_region) { superRegionBuyCount[h.super_region] = (superRegionBuyCount[h.super_region] || 0) + w; regionProfile.supers.add(h.super_region); }
    }

    // 타입 버킷 + 타입×지역 가격 통계
    const bucket = normalizeType(wine?.wine_type || '', wine?.item_name_kr || inv?.item_name || agg.name);
    if (bucket) {
      typeBuckets.add(bucket);
      const group = geoGroup(h);
      addPrice('__all__', avgPrice, agg.pricedCount);
      addPrice(bucket, avgPrice, agg.pricedCount);
      if (group) addPrice(`${bucket}|${group}`, avgPrice, agg.pricedCount);
    } else {
      addPrice('__all__', avgPrice, agg.pricedCount);
    }
    // 지역 분포(광역 → 대지역 → 국가 → 기타 순으로 라벨) — 표시용 "건수"는 횟수 그대로
    const regionLabel = h?.super_region || h?.major_region || country || '기타';
    regionDist[regionLabel] = (regionDist[regionLabel] || 0) + agg.count;

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
      for (const g of grapes) { grapeBuyCount[g] = (grapeBuyCount[g] || 0) + w; grapeKeys.add(g.toLowerCase()); }
    }

    // 와인 타입
    let wt = wine?.wine_type || '';
    if (!wt && (inv?.item_name || agg.name)) {
      wt = extractTypeFromName(inv?.item_name || agg.name);
    }
    if (wt) {
      wt = wt.trim();
      if (wt) typeBuyCount[wt] = (typeBuyCount[wt] || 0) + w;
    }
  }

  const clientAvgPrice = priceList.length > 0
    ? priceList.reduce((a, b) => a + b, 0) / priceList.length : 0;

  // 가격은 '한 숫자'로 안 뭉침(정대처럼 샤블리8만+뫼르소28만 두 가격대는 어떤 값도 못 맞춤).
  //  타입별 [실제 최저 lo ~ 최고 hi] 범위로 게이트하고, 그 안 순위는 취향 점수가 매김. mean=표시용 횟수가중평균.
  const priceStats: Record<string, { mean: number; lo: number; hi: number; n: number }> = {};
  for (const [key, arr] of Object.entries(priceSamples)) {
    const sumW = arr.reduce((a, s) => a + s.w, 0) || 1;
    const mean = arr.reduce((a, s) => a + s.p * s.w, 0) / sumW; // 횟수 가중 평균(표시용)
    // 강건 범위: 가중 p10~p90. 자주 사는 가격대는 포함, 드문 극단(1/n)은 트림.
    priceStats[key] = { mean, lo: weightedQuantile(arr, 0.1), hi: weightedQuantile(arr, 0.9), n: arr.length };
  }

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
    regionDist,
  };
}
