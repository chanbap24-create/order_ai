import { extractEnglish, type RegionHierarchy } from './regions';
import type { ClientPreferences, PurchaseAggEntry, ScoredItem } from './types';
import { priceRef } from './preferences';
import { normalizeType, bucketLabel } from './wineType';
import { geoGroup, geoTier, TIER_LABEL } from './geoTier';
import { extractFlavorKeys, flavorOverlap } from './flavor';

const TIER_BASE = [92, 74, 58]; // 같은마을 / 인근마을 / 같은광역 (점수 표시·정렬 기준)
const FLAVOR_GROUP_KO: Record<string, string> = {
  oak: '오크', citrus: '시트러스', mineral: '미네랄', stonefruit: '핵과', tropical: '열대과일',
  apple: '사과·배', redfruit: '붉은과실', blackfruit: '검은과실', floral: '꽃', spice: '향신료',
  herb: '허브', earth: '흙·가죽', tannic: '탄닌', body_full: '풀바디', body_light: '라이트', creamy: '크리미',
};

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
      // 재주문: 2회 이상 구매 + 3개월 이상 미발주만(같은 와인이라 게이트 자동 충족)
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
      const matchedRegion = t === 0 ? h?.sub_region : t === 1 ? h?.major_region : h?.super_region;
      if (matchedRegion) reasons.push(extractEnglish(matchedRegion));

      // 향미·품종 정렬(0~1)
      let grapeHit = false;
      const gl = invGrapes.toLowerCase();
      for (const g of prefs.grapeKeys) { if (g.length >= 3 && gl.includes(g)) { grapeHit = true; break; } }
      const candFlavor = extractFlavorKeys(wine?._notes || '');
      const fOverlap = flavorOverlap(candFlavor, prefs.flavorKeys);
      const soft = (grapeHit ? 0.6 : 0) + 0.4 * fOverlap;

      if (grapeHit) { tags.push('선호품종'); reasons.push(matchedGrapeLabel(invGrapes, prefs)); }
      if (fOverlap > 0) {
        const shared = [...candFlavor].filter((k) => prefs.flavorKeys.has(k)).map((k) => FLAVOR_GROUP_KO[k] || k);
        if (shared.length) reasons.push(`${shared.slice(0, 3).join('·')} 향`);
      }
      if (invPrice > 0) { tags.push('적정가격'); }

      const velocity = maxSales90d > 0 ? (inv.avg_sales_90d || 0) / maxSales90d : 0;
      score = TIER_BASE[t] + soft * 8 + velocity * 2;
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
