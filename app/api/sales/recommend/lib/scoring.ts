import { extractEnglish, countryKey, type RegionHierarchy } from './regions';
import type { ClientPreferences, PurchaseAggEntry, ScoredItem } from './types';
import { priceRef } from './preferences';
import { normalizeType, bucketLabel } from './wineType';
import { geoGroup, geoTier, TIER_LABEL, type RegionProfile } from './geoTier';
import { extractFlavorKeys, flavorOverlap, flavorLabel } from './flavor';
import { scoreQuoteFeedback, priceBandKey, grapeKeysOf, type QuoteFeedbackProfile } from './quoteFeedback';
import { scoreVenue, type VenueWinePref } from './venueScoring';

const FREQ_STRENGTH: Record<string, number> = { strong: 0.65, soft: 0.3, off: 0 };
export type GeoCeiling = 'super' | 'country' | 'any';
export type FreqStrength = 'strong' | 'soft' | 'off';
export type RecMode = 'new' | 'substitute';

/** 대체상품 모드 기준점: 쇼트난 상품의 지역·가격·타입을 닻으로 삼아 근접 상품을 찾는다. */
export interface SubstituteAnchor {
  itemCode: string;
  profile: RegionProfile; // 쇼트상품 산지 계층(같은마을/인근/광역 판정 기준)
  price: number;          // 쇼트상품 가격(±band 기준)
  bucket: string;         // 쇼트상품 와인타입(레드→레드만 대체)
}

/** 화면에서 조절하는 점수 가중치(전부 숫자라 슬라이더/입력으로 노출 가능). */
export interface ScoreParams {
  tierBase: [number, number, number, number]; // 같은마을/인근마을/같은광역/타지역
  softWeight: number;     // 품종·향미 가산 배수(soft 0~1 × 이 값)
  velocityWeight: number; // 회전 가산 배수(velocity 0~1 × 이 값)
  recentPenalty: number;  // 최근 30일 제안 품목 점수 배율
  convBoost: number;      // 과거 견적→출고 전환 1회당 가점(최대 3회)
  noconvPenalty: number;  // 2회+ 견적·미출고 품목 점수 배율
  quoteFeedbackWeight: number; // 견적학습(속성 단위 전환) ±가중치
  venueWeight: number;    // 업장 유형(스시·프렌치 등) 적합 가산 — 지역·견적학습에서 10씩 차출
}
export const DEFAULT_SCORE_PARAMS: ScoreParams = {
  tierBase: [36, 29, 23, 16], // 지역에서 10점 차출(같은마을 46→36) — 업장 가산에 재배분
  softWeight: 8,
  velocityWeight: 2,
  recentPenalty: 0.45,
  convBoost: 8,
  noconvPenalty: 0.6,
  quoteFeedbackWeight: 34, // 견적학습에서 10점 차출(44→34) — 업장 가산에 재배분
  // 신규제안 완벽 매칭 = 지역36 + 학습34 + 업장20 + 취향8 + 회전2 = 100점 만점
  venueWeight: 20,
};

/**
 * 규칙기반 추천: 타입·가격은 하드 게이트, 지역은 계단(우선순위), 향미·품종은 그 안의 정렬.
 * 정렬 = 점수 내림차순(같은마을 > 인근마을 > 같은광역, 동순위는 향미·품종·견적학습).
 * 신규제안 모드는 거래처가 아직 안 산 와인만 대상(이미 산 와인은 제외 — 재주문은 일반 발주로).
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
  recentlyRecommended?: Set<string>; // 최근 제안 품번(중복 강등)
  conversionMap?: Map<string, { quoted: number; converted: number }>; // 과거 견적→출고 전환
  scoreParams?: ScoreParams; // 화면 조절 가중치(없으면 기본값)
  mode?: RecMode;            // 추천 타입(신규제안/대체상품)
  anchor?: SubstituteAnchor; // 대체상품 모드: 쇼트상품 기준점
  quoteFeedback?: QuoteFeedbackProfile; // 거래처 견적학습 프로필(속성 단위 전환)
  venuePref?: VenueWinePref | null; // 거래처 업장 유형 선호(스시·프렌치 등) — 있으면 적합 가산
}): ScoredItem[] {
  const { inventory, wineMap, purchaseAgg, prefs, priceBandPct, geoCeiling, freqStrength, maxSales90d, recentlyRecommended, conversionMap } = params;
  const mode: RecMode = params.mode ?? 'new';
  const anchor = params.anchor;
  const quoteFeedback = params.quoteFeedback;
  const venuePref = params.venuePref;
  const sp = params.scoreParams ?? DEFAULT_SCORE_PARAMS;
  const TIER_BASE = sp.tierBase;
  const band = priceBandPct > 0 ? priceBandPct : 0.2;
  const strength = FREQ_STRENGTH[freqStrength] ?? 0.65;
  const clientCountries = new Set(Object.keys(prefs.countryBuyCount).map(countryKey));
  const scored: ScoredItem[] = [];

  for (const inv of inventory || []) {
    const itemNo = inv.item_no;
    // 대체상품 모드: 쇼트난 기준 상품 자기 자신은 제외
    if (mode === 'substitute' && anchor && String(itemNo) === anchor.itemCode) continue;
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

    // 신규제안 모드: 이미 산 와인은 제외(재주문은 일반 발주로 — 추천은 새 와인만).
    if (mode !== 'substitute' && purchase) continue;

    // 게이트 ① 타입: 대체=쇼트상품과 같은 타입 / 신규=거래처가 사는 타입
    if (mode === 'substitute') {
      if (!anchor || !bucket || bucket !== anchor.bucket) continue;
    } else {
      if (!prefs.hasHistory) continue;
      if (!bucket || !prefs.typeBuckets.has(bucket)) continue;
    }

    // 게이트 ② 가격: 기준가 ±band 밖이면 제외
    {
      const ref = mode === 'substitute' && anchor ? anchor.price : priceRef(prefs, bucket, geoGroup(h));
      if (ref > 0 && invPrice > 0) {
        const diff = Math.abs(invPrice - ref) / ref;
        if (diff > band) continue;
      }
    }

    // 계단: 대체=쇼트상품 산지 / 그 외=거래처 산지. 광역 천장 밖이면 제외.
    const tierProfile = mode === 'substitute' && anchor ? anchor.profile : prefs.regionProfile;
    let t = geoTier(h, tierProfile);
    if (t === null) {
      if (geoCeiling === 'super') continue; // 광역까지만: 제외
      else if (geoCeiling === 'country') {
        if (invCountry && clientCountries.has(countryKey(invCountry))) t = 3; else continue; // 같은 국가까지
      } else t = 3; // 제한없음
    }
    tags.push(TIER_LABEL[t]);
    const matchedRegion = (t === 0 ? h?.sub_region : t === 1 ? h?.major_region : t === 2 ? h?.super_region : '') || '';
    const matchedCount = t === 0 ? (prefs.subRegionBuyCount[matchedRegion] || 0)
      : t === 1 ? (prefs.majorRegionBuyCount[matchedRegion] || 0)
      : t === 2 ? (prefs.superRegionBuyCount[matchedRegion] || 0) : 0;
    const levelMax = t === 0 ? prefs.maxSubRegionBuy : t === 1 ? prefs.maxMajorRegionBuy : t === 2 ? prefs.maxSuperRegionBuy : 1;
    const freqW = levelMax > 0 ? matchedCount / levelMax : 0;
    if (mode === 'substitute') {
      if (matchedRegion) reasons.push(`${extractEnglish(matchedRegion)} (대체)`);
      else if (invCountry) reasons.push(extractEnglish(invCountry));
    } else {
      if (matchedRegion) reasons.push(`${extractEnglish(matchedRegion)} 선호 ${Math.round(freqW * 100)}%`);
      else if (invCountry) reasons.push(extractEnglish(invCountry));
    }

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
    // 빈도 가중: 대체상품은 거래처 빈도 개념이 없으니 순수 지역점수(배수 1).
    const effStrength = mode === 'substitute' ? 0 : strength;
    const freqMult = (1 - effStrength) + effStrength * freqW;
    const tierScore = TIER_BASE[t] * freqMult;
    const softAdd = soft * sp.softWeight;
    const velAdd = velocity * sp.velocityWeight;
    score = tierScore + softAdd + velAdd;
    breakdown.push(`${TIER_LABEL[t]} ${TIER_BASE[t]} × 빈도 ${freqMult.toFixed(2)} = ${tierScore.toFixed(1)}`);
    if (softAdd > 0) breakdown.push(`품종·향미 ${soft.toFixed(2)}×${sp.softWeight} = +${softAdd.toFixed(1)}`);
    if (velAdd > 0) breakdown.push(`회전 ${velocity.toFixed(2)}×${sp.velocityWeight} = +${velAdd.toFixed(1)}`);

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

    // 견적학습(긍정만): 과거 견적에서 '먹힌 속성(산지·가격대·타입·품종·향)'을 비슷한 새 후보로 넓혀 가산.
    // 거절(안 산 것)은 그 병 특유일 수 있어 일반화하지 않음 — 위의 미전환 ×0.6(품목 단위)이 담당.
    if (quoteFeedback && sp.quoteFeedbackWeight > 0) {
      const fb = scoreQuoteFeedback(quoteFeedback, {
        region: geoGroup(h),
        priceBand: priceBandKey(invPrice),
        type: bucket,
        grapes: grapeKeysOf(invGrapes),
        flavors: [...extractFlavorKeys(wine?._notes || '')],
      }, sp.quoteFeedbackWeight);
      if (fb > 0) {
        score += fb;
        tags.push('견적선호');
        breakdown.push(`견적학습 +${fb.toFixed(1)}`);
      }
    }

    // 업장 유형 적합: 거래처 업장(스시·프렌치 등) 선호와 맞으면 가산 — 타입·나라·지역 3축 독립.
    if (venuePref && sp.venueWeight > 0) {
      const regionText = `${h?.sub_region || ''} ${h?.major_region || ''} ${h?.super_region || ''} ${wine?.region || ''}`;
      const vb = scoreVenue(venuePref, { bucket, country: `${wine?.country || ''} ${invCountry}`, regionText }, sp.venueWeight);
      if (vb.total > 0) {
        score += vb.total;
        tags.push('업장적합');
        breakdown.push(`업장적합 +${vb.total.toFixed(1)} (타입 ${vb.type}+나라 ${vb.country}+지역 ${vb.region})`);
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
