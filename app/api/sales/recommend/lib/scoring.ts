import { extractEnglish, countryKey, type RegionHierarchy } from './regions';
import type { ClientPreferences, PurchaseAggEntry, ScoredItem } from './types';
import { priceRef } from './preferences';
import { normalizeType, bucketLabel } from './wineType';
import { geoGroup, geoTier, TIER_LABEL } from './geoTier';
import { extractFlavorKeys, flavorOverlap, flavorLabel } from './flavor';

const FREQ_STRENGTH: Record<string, number> = { strong: 0.65, soft: 0.3, off: 0 };
export type GeoCeiling = 'super' | 'country' | 'any';
export type FreqStrength = 'strong' | 'soft' | 'off';

/** 화면에서 조절하는 점수 가중치(전부 숫자라 슬라이더/입력으로 노출 가능). */
export interface ScoreParams {
  tierBase: [number, number, number, number]; // 같은마을/인근마을/같은광역/타지역
  reorderScore: number;   // 재주문(옛 단골) 고정 점수
  softWeight: number;     // 품종·향미 가산 배수(soft 0~1 × 이 값)
  velocityWeight: number; // 회전 가산 배수(velocity 0~1 × 이 값)
  recentPenalty: number;  // 최근 30일 제안 품목 점수 배율
  convBoost: number;      // 과거 견적→출고 전환 1회당 가점(최대 3회)
  noconvPenalty: number;  // 2회+ 견적·미출고 품목 점수 배율
}
export const DEFAULT_SCORE_PARAMS: ScoreParams = {
  tierBase: [92, 74, 58, 42],
  reorderScore: 100,
  softWeight: 8,
  velocityWeight: 2,
  recentPenalty: 0.45,
  convBoost: 8,
  noconvPenalty: 0.6,
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
  geoCeiling: GeoCeiling;   // 지역 확장 천장(광역/국가/제한없음)
  freqStrength: FreqStrength; // 입고빈도 반영 강도
  maxSales90d: number;
  threeMonthsAgoStr: string;
  recentlyRecommended?: Set<string>; // 최근 제안 품번(중복 강등)
  conversionMap?: Map<string, { quoted: number; converted: number }>; // 과거 견적→출고 전환
  scoreParams?: ScoreParams; // 화면 조절 가중치(없으면 기본값)
}): ScoredItem[] {
  const { inventory, wineMap, purchaseAgg, prefs, priceBandPct, geoCeiling, freqStrength, maxSales90d, threeMonthsAgoStr, recentlyRecommended, conversionMap } = params;
  const sp = params.scoreParams ?? DEFAULT_SCORE_PARAMS;
  const TIER_BASE = sp.tierBase;
  const band = priceBandPct > 0 ? priceBandPct : 0.2;
  const strength = FREQ_STRENGTH[freqStrength] ?? 0.65;
  const clientCountries = new Set(Object.keys(prefs.countryBuyCount).map(countryKey));
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
    const breakdown: string[] = []; // 점수 분해(표시용)

    if (purchase) {
      // 이미 정기적으로 받는 와인은 추천에서 제외(이상함). 최근 구매/1회성은 빼고,
      // 3개월 이상 미발주한 옛 단골만 '재주문'으로 환기(지금은 안 받는 와인).
      const isStale = !purchase.lastDate || purchase.lastDate <= threeMonthsAgoStr;
      if (purchase.count < 2 || !isStale) continue;
      score = sp.reorderScore;
      tags.push('재주문');
      reasons.push(`${purchase.count}회 구매 · ${purchase.lastDate || '날짜미상'} 이후 미발주`);
      breakdown.push(`재주문 고정 ${sp.reorderScore}`);
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
      let t = geoTier(h, prefs.regionProfile);
      if (t === null) {
        // 광역 천장 밖 — '확장 범위' 설정에 따라 처리
        if (geoCeiling === 'super') continue; // 광역까지만: 제외
        else if (geoCeiling === 'country') {
          if (invCountry && clientCountries.has(countryKey(invCountry))) t = 3; else continue; // 같은 국가까지
        } else t = 3; // 제한없음: 타입·가격만 통과
      }
      tags.push(TIER_LABEL[t]);
      const matchedRegion = (t === 0 ? h?.sub_region : t === 1 ? h?.major_region : t === 2 ? h?.super_region : '') || '';
      // 입고 빈도 가중: 그 지역을 자주 산 거래처일수록 가점, 1회성 지역은 강하게 감점
      const matchedCount = t === 0 ? (prefs.subRegionBuyCount[matchedRegion] || 0)
        : t === 1 ? (prefs.majorRegionBuyCount[matchedRegion] || 0)
        : t === 2 ? (prefs.superRegionBuyCount[matchedRegion] || 0) : 0;
      const levelMax = t === 0 ? prefs.maxSubRegionBuy : t === 1 ? prefs.maxMajorRegionBuy : t === 2 ? prefs.maxSuperRegionBuy : 1;
      const freqW = levelMax > 0 ? matchedCount / levelMax : 0;
      // 가중치가 매입액 기반이므로 raw 수치 대신 동급 산지 내 선호 비중(%)으로 표기
      if (matchedRegion) reasons.push(`${extractEnglish(matchedRegion)} 선호 ${Math.round(freqW * 100)}%`);
      else if (invCountry) reasons.push(extractEnglish(invCountry));

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
      // 빈도 가중(강도 조절): strong 0.65 / soft 0.3 / off 0. off면 빈도 무시(고정 배수 1).
      const freqMult = (1 - strength) + strength * freqW;
      const tierScore = TIER_BASE[t] * freqMult;
      const softAdd = soft * sp.softWeight;
      const velAdd = velocity * sp.velocityWeight;
      score = tierScore + softAdd + velAdd;
      breakdown.push(`${TIER_LABEL[t]} ${TIER_BASE[t]} × 빈도 ${freqMult.toFixed(2)} = ${tierScore.toFixed(1)}`);
      if (softAdd > 0) breakdown.push(`품종·향미 ${soft.toFixed(2)}×${sp.softWeight} = +${softAdd.toFixed(1)}`);
      if (velAdd > 0) breakdown.push(`회전 ${velocity.toFixed(2)}×${sp.velocityWeight} = +${velAdd.toFixed(1)}`);
    }

    if ((inv.available_stock || 0) <= 0 && ((inv.bonded_warehouse || 0) > 0 || (inv.bonded_kctc || 0) > 0)) tags.push('통관필요');

    // 최근 30일 이미 제안한 품목은 강등(영구 제외 아님 — 신선한 후보가 위로 올라오게).
    if (recentlyRecommended?.has(String(itemNo))) {
      score *= sp.recentPenalty; tags.push('최근제안');
      breakdown.push(`최근제안 ×${sp.recentPenalty}`);
    }

    // 과거 견적→실제 출고 전환 반영: 팔린 와인은 가점, 여러 번 권했는데 안 팔린 건 감점.
    const cv = conversionMap?.get(String(itemNo));
    if (cv) {
      if (cv.converted > 0) {
        const boost = Math.min(cv.converted, 3) * sp.convBoost;
        score += boost;
        tags.push('과거전환');
        reasons.push(`과거 견적 ${cv.quoted}회 중 ${cv.converted}회 출고`);
        breakdown.push(`과거전환 +${boost}`);
      } else if (cv.quoted >= 2) {
        score *= sp.noconvPenalty;
        tags.push('미전환');
        breakdown.push(`미전환 ×${sp.noconvPenalty}`);
      }
    }
    breakdown.push(`= ${(Math.round(score * 10) / 10).toFixed(1)}`);

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
      stock: inv._totalStock ?? ((inv.available_stock || 0) + (inv.bonded_warehouse || 0) + (inv.bonded_kctc || 0)),
      score: Math.round(score * 10) / 10,
      tags,
      reason: reasons.join(' · ') || '추천 와인',
      buy_count: purchase?.count,
      last_order: purchase?.lastDate,
      image_url: (wine?.image_url as string) || '',
      brand: (wine?.supplier as string) || (wine?.brand as string) || '',
      vintage,
      breakdown,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

// 견적 표시 순서: 타입(스파클링→화이트→레드→로제→주정강화) 그룹 + 각 타입 내 공급가 내림차순
const QUOTE_TYPE_RANK: Record<string, number> = { '스파클링': 0, '화이트': 1, '레드': 2, '로제': 3, '주정강화': 4 };
export function orderForDisplay(items: ScoredItem[]): ScoredItem[] {
  return [...items].sort((a, b) => {
    const ra = QUOTE_TYPE_RANK[a.wine_type] ?? 9;
    const rb = QUOTE_TYPE_RANK[b.wine_type] ?? 9;
    if (ra !== rb) return ra - rb;
    return (b.price || 0) - (a.price || 0);
  });
}

// 후보 품종 중 거래처 선호품종과 겹친 것의 한글/원문 라벨
function matchedGrapeLabel(invGrapes: string, prefs: ClientPreferences): string {
  const gl = invGrapes.toLowerCase();
  for (const [g] of prefs.topGrapes) {
    if (gl.includes(g.toLowerCase())) return g;
  }
  return invGrapes.split(/[,\/]/)[0]?.trim() || '품종';
}
