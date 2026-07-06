// 추천 응답의 summary(거래처 분석) 객체 구성 — buildCandidates 슬림화용.
import { bucketLabel } from './wineType';
import { extractEnglish } from './regions';
import { flavorLabel } from './flavor';
import type { ClientPreferences, PurchaseAggEntry } from './types';

export function buildSummary(
  purchaseAgg: Record<string, PurchaseAggEntry>,
  prefs: ClientPreferences,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wineMap: Map<string, any>,
  profileMonths: number,
  bandPct: number,
  lastOrderDate: string | null,
) {
  return {
    total_items: Object.keys(purchaseAgg).length,
    avg_price: Math.round(prefs.clientAvgPrice),
    last_order_date: lastOrderDate,
    top_countries: prefs.topCountries.slice(0, 3).map((e) => e[0]),
    top_grapes: prefs.topGrapes.slice(0, 3).map((e) => e[0]),
    top_types: prefs.topTypes.slice(0, 3).map((e) => e[0]),
    top_regions: Object.entries(prefs.subRegionBuyCount)
      .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([r]) => extractEnglish(r)),
    analysis: {
      types: Array.from(prefs.typeBuckets).map(bucketLabel).filter(Boolean),
      broad_regions: (Object.keys(prefs.superRegionBuyCount).length
        ? Object.entries(prefs.superRegionBuyCount)
        : Object.entries(prefs.majorRegionBuyCount)
      ).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([r]) => extractEnglish(r)),
      // 선호강도(빈도) 상위 순으로 자세히(최대 14개)
      flavors: [...prefs.flavorWeights.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k]) => flavorLabel(k)),
      avg_price: Math.round(prefs.clientAvgPrice),
      band_pct: Math.round(bandPct * 100),
      type_prices: Array.from(prefs.typeBuckets).map((b) => {
        const s = prefs.priceStats[b];
        // avg=가중평균, lo/hi=가중 p10/p90(실제 가격 게이트 범위의 근거)
        return { type: bucketLabel(b), avg: s && s.n ? Math.round(s.mean) : 0, lo: s && s.n ? Math.round(s.lo) : 0, hi: s && s.n ? Math.round(s.hi) : 0 };
      }).filter((t) => t.type && t.avg > 0).sort((a, b) => b.avg - a.avg),
      region_dist: (() => {
        const total = Object.values(prefs.regionDist).reduce((a, b) => a + b, 0) || 1;
        return Object.entries(prefs.regionDist)
          .sort((a, b) => b[1] - a[1]).slice(0, 7)
          .map(([r, c]) => ({ label: extractEnglish(r), count: c, pct: Math.round((c / total) * 100) }));
      })(),
      period_months: profileMonths,
      purchased: Object.entries(purchaseAgg)
        .map(([code, agg]) => {
          const w = wineMap.get(code);
          const h = w?._hierarchy;
          const region = h?.sub_region ? extractEnglish(h.sub_region)
            : h?.major_region ? extractEnglish(h.major_region)
            : (w?.region || '');
          return { name: w?.item_name_kr || agg.name || code, region, count: agg.count, last: agg.lastDate || null };
        })
        .sort((a, b) => (b.last || '').localeCompare(a.last || '') || b.count - a.count)
        .slice(0, 20),
    },
  };
}
