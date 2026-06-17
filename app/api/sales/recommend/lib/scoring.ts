import { extractEnglish, type RegionHierarchy } from './regions';
import type { ClientPreferences, PurchaseAggEntry, ScoredItem } from './types';
import { priceRef } from './preferences';
import { normalizeType, bucketLabel } from './wineType';
import { geoGroup, geoTier, TIER_LABEL } from './geoTier';
import { extractFlavorKeys, flavorOverlap, flavorLabel } from './flavor';

const TIER_BASE = [92, 74, 58]; // 같은마을 / 인근마을 / 같은광역 (점수 표시·정렬 기준)

/**
 * 규칙기반 추천: 타입·가격은 하드 게이트, 지역은 계단(우선순위), 향미·품종은 그 안의 정렬.
 * 정렬 = 점수 내림차순(재주문 100 > 같은마을 > 인근마을 > 같은광역, 동순위는 향미·품종).
 */
export function scoreRecommendations(params: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inventory: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wineMap: Map<string, any>;
  purchaseAgg: Record<string, PurchaseAggEntry>;
  prefs: ClientPreferences;
  priceBandPct: number; // 0.2 = ±20%
  maxSales90d: number;
  threeMonthsAgoStr: string;
}): ScoredItem[] {
  const { inventory, wineMap, purchaseAgg, prefs, priceBandPct, maxSales90d, threeMonthsAgoStr } = params;
  const band = priceBandPct > 0 ? priceBandPct : 0.2;
  const scored: ScoredItem[] = [];

  for (const inv of inventory || []) {
    const itemNo = inv.item_no;
    const wine = wineMap.get(itemNo);
    const invCountry = wine?.country || wine?.country_en || inv.country || '';
    const invGrapes = wine?.grape_varieties || '';
    const name = wine?.item_name_kr || inv.item_name || '';
    const bucket = normalizeType(wine?.wine_type || '', name);
    const invPrice = inv.supply_price || 0;
    const h: RegionHierarchy | null = wine?._hierarchy || null;
    const purchase = purchaseAgg[itemNo];

    let score = 0;
    const tags: string[] = [];
    const reasons: string[] = [];

    if (purchase) {
      // 이미 정기적으로 받는 와인은 추천에서 제외(이상함). 최근 구매/1회성은 빼고,
      // 3개월 이상 미발주한 옛 단골만 '재주문'으로 환기(지금은 안 받는 와인).
      const isStale = !purchase.lastDate || purchase.lastDate <= threeMonthsAgoStr;
      if (purchase.count < 2 || !isStale) continue;
      score = 100;
      tags.push('재주문');
      reasons.push(`${purchase.count}회 구매 · ${purchase.lastDate || '날짜미상'} 이후 미발주`);
    } else {
      // 게이트 ① 타입: 거래처가 사는 타입만
      if (!prefs.hasHistory) continue;
      if (!bucket || !prefs.typeBuckets.has(bucket)) continue;

      // 게이트 ② 가격: 타입+지역 평균 ±band 밖이면 제외
      const ref = priceRef(prefs, bucket, geoGroup(h));
      if (ref > 0 && invPrice > 0) {
        const diff = Math.abs(invPrice - ref) / ref;
        if (diff > band) continue;
      }

      // 계단: 광역 천장(밖이면 제외)
      const t = geoTier(h, prefs.regionProfile);
      if (t === null) continue;
      tags.push(TIER_LABEL[t]);
      const matchedRegion = (t === 0 ? h?.sub_region : t === 1 ? h?.major_region : h?.super_region) || '';
      // 입고 빈도 가중: 그 지역을 자주 산 거래처일수록 가점, 1회성 지역은 강하게 감점
      const matchedCount = t === 0 ? (prefs.subRegionBuyCount[matchedRegion] || 0)
        : t === 1 ? (prefs.majorRegionBuyCount[matchedRegion] || 0)
        : (prefs.superRegionBuyCount[matchedRegion] || 0);
      const levelMax = t === 0 ? prefs.maxSubRegionBuy : t === 1 ? prefs.maxMajorRegionBuy : prefs.maxSuperRegionBuy;
      const freqW = levelMax > 0 ? matchedCount / levelMax : 0;
      if (matchedRegion) reasons.push(`${extractEnglish(matchedRegion)} 입고 ${matchedCount}회`);

      // 향미·품종 정렬(0~1)
      let grapeHit = false;
      const gl = invGrapes.toLowerCase();
      for (const g of prefs.grapeKeys) { if (g.length >= 3 && gl.includes(g)) { grapeHit = true; break; } }
      const candFlavor = extractFlavorKeys(wine?._notes || '');
      const fOverlap = flavorOverlap(candFlavor, prefs.flavorKeys);
      const soft = (grapeHit ? 0.6 : 0) + 0.4 * fOverlap;

      if (grapeHit) { tags.push('선호품종'); reasons.push(matchedGrapeLabel(invGrapes, prefs)); }
      if (fOverlap > 0) {
        const shared = [...candFlavor].filter((k) => prefs.flavorKeys.has(k)).map(flavorLabel);
        if (shared.length) reasons.push(`${shared.slice(0, 3).join('·')} 향`);
      }
      if (invPrice > 0) { tags.push('적정가격'); }

      const velocity = maxSales90d > 0 ? (inv.avg_sales_90d || 0) / maxSales90d : 0;
      // 빈도 가중: 자주 산 지역은 1.0배, 1회성 지역은 ~0.35배로 강하게 하향
      score = TIER_BASE[t] * (0.35 + 0.65 * freqW) + soft * 8 + velocity * 2;
    }

    if ((inv.available_stock || 0) <= 0 && (inv.bonded_warehouse || 0) > 0) tags.push('통관필요');

    const vv = String(itemNo).slice(2, 4);
    const vintage = /^\d{2}$/.test(vv)
      ? (Number(vv) >= 50 ? `19${vv}` : `20${vv}`)
      : (['NV', 'MV'].includes(vv.toUpperCase()) ? vv.toUpperCase() : '');

    scored.push({
      item_no: itemNo,
      item_name: inv.item_name,
      country: invCountry,
      region: wine?.region || '',
      grape: invGrapes,
      wine_type: bucketLabel(bucket) || wine?.wine_type || '',
      price: invPrice,
      stock: inv._totalStock ?? ((inv.available_stock || 0) + (inv.bonded_warehouse || 0)),
      score: Math.round(score * 10) / 10,
      tags,
      reason: reasons.join(' · ') || '추천 와인',
      buy_count: purchase?.count,
      last_order: purchase?.lastDate,
      image_url: (wine?.image_url as string) || '',
      brand: (wine?.supplier as string) || (wine?.brand as string) || '',
      vintage,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

// 후보 품종 중 거래처 선호품종과 겹친 것의 한글/원문 라벨
function matchedGrapeLabel(invGrapes: string, prefs: ClientPreferences): string {
  const gl = invGrapes.toLowerCase();
  for (const [g] of prefs.topGrapes) {
    if (gl.includes(g.toLowerCase())) return g;
  }
  return invGrapes.split(/[,\/]/)[0]?.trim() || '품종';
}
