import { extractEnglish, countryKey, type RegionHierarchy } from './regions';
import type { ClientPreferences, PurchaseAggEntry, ScoredItem } from './types';
import { priceRef, priceFloor, priceCeil } from './preferences';
import { normalizeType, bucketLabel } from './wineType';
import { geoGroup, geoTier, TIER_LABEL, type RegionProfile } from './geoTier';
import { flavorMatchScore, flavorLabel, wineFlavorKeys } from './flavor';
import { scoreQuoteFeedback, priceBandKey, grapeKeysOf, type QuoteFeedbackProfile } from './quoteFeedback';
import { compareForDisplay } from '@/app/sales/recommend/displayOrder';

export type GeoCeiling = 'super' | 'country' | 'any';
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
  tierBase: [number, number, number, number]; // 산지: 같은마을/인근마을/같은광역/타지역
  softWeight: number;     // 취향(품종·향미) 가산 배수(soft 0~1 × 이 값)
  recentPenalty: number;  // 최근 30일 제안 품목 점수 배율
  quoteFeedbackWeight: number; // 견적학습(속성 단위 전환) 가중치
}
export const DEFAULT_SCORE_PARAMS: ScoreParams = {
  // 통합 96점 = 산지20 + 취향10 + 견적15(이력) + 업장15 + 업태20 + 지역16(타입8·국가8). 세그먼트는 profile 기반(scoreParams 밖).
  tierBase: [20, 16, 12, 8],  // 산지: 같은마을20/인근16/광역12/타지역8
  softWeight: 10,             // 취향(품종·향)
  recentPenalty: 0.45,        // 최근 제안 강등
  quoteFeedbackWeight: 15,    // 견적학습
};

// 세그먼트(업장·업태·지역) = 그 세그먼트가 사는 '와인 타입' 순위 + '국가' 순위로 배점.
export interface SegRank { typeRank: Map<string, number>; countryRank: Map<string, number>; }
export interface SegScorers { venue?: SegRank | null; bt?: SegRank | null; region?: SegRank | null; }
export type SegPts = {
  venueType: number[]; venueCtry: number[];
  btType: number[]; btCtry: number[];
  regionType: number[]; regionCtry: number[];
};
export const SEG_PTS: SegPts = {
  venueType: [10, 7, 4], venueCtry: [5, 3, 2],   // 업장 15 = 타입10 + 국가5
  btType: [12, 8, 4], btCtry: [8, 5, 3],         // 업태 20 = 타입12 + 국가8
  regionType: [8, 5, 3], regionCtry: [8, 5, 3],  // 지역 16 = 타입8 + 국가8 (지역 타입분포는 generic → 축소, 백테스트상 무손실)
};
// rank 0/1/2 = 1등/2등/3등, 그 외(≥3, 분포엔 있음) = 1점, 없음(undefined) = 0.
function rankPts(rank: number | undefined, tbl: number[]): number {
  if (rank === undefined || rank < 0) return 0;
  return rank < tbl.length ? tbl[rank] : 1;
}

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
  maxSales90d: number;
  recentlyRecommended?: Set<string>; // 최근 제안 품번(중복 강등)
  conversionMap?: Map<string, { quoted: number; converted: number }>; // 과거 견적→출고 전환
  scoreParams?: ScoreParams; // 화면 조절 가중치(없으면 기본값)
  mode?: RecMode;            // 추천 타입(신규제안/대체상품)
  anchor?: SubstituteAnchor; // 대체상품 모드: 쇼트상품 기준점
  quoteFeedback?: QuoteFeedbackProfile; // 거래처 견적학습 프로필(속성 단위 전환)
  segScorers?: SegScorers;          // 업장·업태·지역 세그먼트의 타입/국가 분포 순위
  segPts?: SegPts;                  // 세그먼트 배점 오버라이드(백테스트용). 기본 SEG_PTS.
  regionPriceRef?: number;          // 지역별 추천가(중앙값). >0이면 ±band로 가격 게이트.
  typeShares?: Record<string, number>; // 타입별 비중(본인 이력 우선). 비주력 타입(<5%) 강등용. bucketLabel 키.
  priceGate?: 'hard' | 'soft' | 'off'; // 신규제안 가격 범위 게이트. hard=범위밖 제외(기본) · soft=거리비례 감점 · off=무시.
}): ScoredItem[] {
  const { inventory, wineMap, purchaseAgg, prefs, priceBandPct, geoCeiling, recentlyRecommended, conversionMap } = params;
  const mode: RecMode = params.mode ?? 'new';
  const anchor = params.anchor;
  const quoteFeedback = params.quoteFeedback;
  const segScorers = params.segScorers;
  const regionPriceRef = params.regionPriceRef ?? 0;
  const typeShares = params.typeShares;
  const unified = mode !== 'substitute'; // 신규제안: 게이트 풀고 모든 와인을 하나의 점수판으로(개인화+세그먼트)
  const sp = params.scoreParams ?? DEFAULT_SCORE_PARAMS;
  const TIER_BASE = sp.tierBase;
  const band = priceBandPct > 0 ? priceBandPct : 0.2;
  const priceGate = params.priceGate ?? 'soft'; // 신규제안 기본 소프트(범위밖 감점) — 백테스트상 하드컷보다 hit·recall 우위
  const clientCountries = new Set(Object.keys(prefs.countryBuyCount).map(countryKey));
  const scored: ScoredItem[] = [];

  for (const inv of inventory || []) {
    const itemNo = inv.item_no;
    // 통관 안 된 아이템(국내 가용재고 0, 보세창고만) 추천 제외 — 바로 못 파는 재고는 제안 X.
    if ((inv.available_stock || 0) <= 0) continue;
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
      if (!bucket) continue; // 통합: 타입 게이트 없음 — 안 사본 타입도 점수로 자연 구분(세그먼트가 채움)
    }

    // 게이트 ② 가격. 대체=주력밴드(±band). 신규제안(통합)=타입별 실구매가 p10~p90 ±band 범위.
    const isPremium = false;
    let pricePenalty = 0; // 소프트 게이트: 범위 밖 거리비례 감점(아래에서 score에 반영)
    if (mode === 'substitute') {
      const ref = anchor ? anchor.price : priceRef(prefs, bucket, geoGroup(h));
      if (ref > 0 && invPrice > 0 && Math.abs(invPrice - ref) / ref > band) continue;
    } else {
      // 통합: 가격은 '범위'. 그 타입 실제 구매가 p10~p90(정대 화이트 9만~28만, 슬리피 2~4만) ±옵션 band.
      //   단일 대표값 안 씀 — 두 봉우리(싼 다수+비싼 소수) 다 포함, 순위는 취향 점수가 매김.
      const ref = priceRef(prefs, bucket, geoGroup(h)) || regionPriceRef; // 데이터 유무 판정용
      const lo = priceFloor(prefs, bucket, geoGroup(h)) || ref;
      const hi = Math.max(lo, priceCeil(prefs, bucket, geoGroup(h)), ref);
      const gLo = lo * (1 - band), gHi = hi * (1 + band);
      if (ref > 0 && invPrice > 0 && (invPrice < gLo || invPrice > gHi)) {
        if (priceGate === 'hard') continue;          // 기본: 범위 밖 제외
        else if (priceGate === 'soft') {             // 소프트: 범위 밖 거리비례 감점(최대 −35), 제외 안 함
          const dist = invPrice < gLo ? (gLo - invPrice) / gLo : (invPrice - gHi) / gHi;
          pricePenalty = 35 * Math.min(1, dist);
        }
        // 'off' → 감점·제외 없음
      }
    }

    // 계단: 대체=쇼트상품 산지 / 그 외=거래처 산지. 광역 천장 밖이면 제외.
    const tierProfile = mode === 'substitute' && anchor ? anchor.profile : prefs.regionProfile;
    let t = geoTier(h, tierProfile);
    if (t === null) {
      if (unified) t = -1; // 통합: 산지 매칭 없음 → 산지 0점(제외 안 함, 세그먼트로 점수)
      else if (geoCeiling === 'super') continue; // 광역까지만: 제외
      else if (geoCeiling === 'country') {
        if (invCountry && clientCountries.has(countryKey(invCountry))) t = 3; else continue; // 같은 국가까지
      } else t = 3; // 제한없음
    }
    if (t >= 0) tags.push(TIER_LABEL[t]);
    const matchedRegion = (t === 0 ? h?.sub_region : t === 1 ? h?.major_region : t === 2 ? h?.super_region : '') || '';
    if (matchedRegion) reasons.push(mode === 'substitute' ? `${extractEnglish(matchedRegion)} (대체)` : extractEnglish(matchedRegion));
    else if (invCountry) reasons.push(extractEnglish(invCountry));

    // 향미·품종 정렬(0~1)
    //  품종: 이진(0.6) → 선호강도 가중(주력 품종 매칭=full, 마이너=적게). topGrapes는 가중 내림차순.
    const gl = invGrapes.toLowerCase();
    let grapeScore = 0;
    for (const [g, gw] of prefs.topGrapes) {
      if (g.length >= 3 && gl.includes(g.toLowerCase())) { grapeScore = gw / prefs.maxGrapeBuy; break; }
    }
    const grapeHit = grapeScore > 0;
    //  향미: 단순 겹침(넓은 향미셋이면 포화) → 후보 향의 '거래처 선호강도' 평균으로 변별.
    const candFlavor = wineFlavorKeys(wine);
    const fOverlap = flavorMatchScore(candFlavor, prefs.flavorWeights);
    const soft = 0.6 * grapeScore + 0.4 * fOverlap;

    if (grapeHit) { tags.push('선호품종'); reasons.push(matchedGrapeLabel(invGrapes, prefs)); }
    if (fOverlap > 0) {
      const shared = [...candFlavor].filter((k) => prefs.flavorKeys.has(k)).map(flavorLabel);
      if (shared.length) reasons.push(`${shared.slice(0, 3).join('·')} 향`);
    }
    if (invPrice > 0 && !isPremium) { tags.push('적정가격'); }

    const tierScore = t >= 0 ? TIER_BASE[t] : 0; // 산지 계단 점수(빈도 가중 제거 — 자주 산 산지는 다른 지표가 이미 반영)
    // 취향 곡선: soft²로 가파르게 — 강한 매칭만 고득점, 어중간(품종만·향 조금)은 급락(변별력↑). 최대는 그대로 softWeight.
    const softAdd = soft * soft * sp.softWeight;
    score = tierScore + softAdd;
    if (t >= 0) breakdown.push(`${TIER_LABEL[t]} +${tierScore.toFixed(0)}`);
    if (softAdd > 0) breakdown.push(`품종·향미 ${soft.toFixed(2)}²×${sp.softWeight} = +${softAdd.toFixed(1)}`);

    if ((inv.available_stock || 0) <= 0 && ((inv.bonded_warehouse || 0) > 0 || (inv.bonded_kctc || 0) > 0)) tags.push('통관필요');

    // 최근 30일 이미 제안한 품목은 강등(영구 제외 아님 — 신선한 후보가 위로 올라오게).
    if (recentlyRecommended?.has(String(itemNo))) {
      score *= sp.recentPenalty; tags.push('최근제안');
      breakdown.push(`최근제안 ×${sp.recentPenalty}`);
    }

    // 과거 견적에 넣었는데 안 산 와인 → 거절 횟수 비례 flat 감점(1회 −5 / 2회 −10 / 3회+ −15).
    // ('+'는 없음 — 산 와인은 신규제안에서 이미 제외되므로.)
    const cv = conversionMap?.get(String(itemNo));
    if (cv && cv.converted === 0 && cv.quoted > 0) {
      const penalty = cv.quoted >= 3 ? 21 : cv.quoted === 2 ? 14 : 7;
      score -= penalty;
      tags.push('과거거절');
      reasons.push(`과거 견적 ${cv.quoted}회 미구매`);
      breakdown.push(`과거거절 −${penalty}`);
    }

    // 소프트 가격 게이트: 범위 밖 품목은 제외 대신 감점(신규 가격탐색 허용)
    if (pricePenalty > 0) {
      score -= pricePenalty;
      tags.push('가격범위밖');
      breakdown.push(`가격범위밖 −${pricePenalty.toFixed(1)}`);
    }

    // 견적학습(긍정만): 과거 견적에서 '먹힌 속성(산지·가격대·타입·품종·향)'을 비슷한 새 후보로 넓혀 가산.
    // 거절(안 산 것)은 그 병 특유일 수 있어 일반화하지 않음 — 위의 미전환 ×0.6(품목 단위)이 담당.
    if (quoteFeedback && sp.quoteFeedbackWeight > 0) {
      const fb = scoreQuoteFeedback(quoteFeedback, {
        region: geoGroup(h),
        priceBand: priceBandKey(invPrice),
        type: bucket,
        grapes: grapeKeysOf(invGrapes),
        flavors: [...wineFlavorKeys(wine)],
      }, sp.quoteFeedbackWeight);
      if (fb > 0) {
        score += fb;
        tags.push('견적선호');
        breakdown.push(`견적학습 +${fb.toFixed(1)}`);
      }
    }

    if (isPremium) { tags.push('프리미엄'); reasons.push('💎 프리미엄 제안'); breakdown.push('프리미엄 트랙(초고가 밴드)'); }

    // 통합: 세그먼트 축(업장·업태·지역) = 그 세그먼트가 사는 '타입' 순위 + '국가' 순위로 가산.
    const persScore = score; // 개인화 소계(산지+취향+견적) — 라벨 판정용
    if (unified && segScorers) {
      const wt = bucketLabel(bucket) || ''; // 와인 타입(스파클링/화이트/레드…)
      const wc = invCountry || '';           // 국가
      const addSeg = (sc: SegRank | null | undefined, typeTbl: number[], ctryTbl: number[], label: string) => {
        if (!sc) return;
        const tp = rankPts(sc.typeRank.get(wt), typeTbl);
        const cp = rankPts(sc.countryRank.get(wc), ctryTbl);
        if (tp + cp > 0) { score += tp + cp; breakdown.push(`${label} 타입 +${tp}·국가 +${cp}`); }
      };
      const SEG = params.segPts ?? SEG_PTS;
      addSeg(segScorers.venue, SEG.venueType, SEG.venueCtry, '업장');
      addSeg(segScorers.bt, SEG.btType, SEG.btCtry, '업태');
      addSeg(segScorers.region, SEG.regionType, SEG.regionCtry, '지역');
    }
    // 비주력 타입 강등: 본인(무이력이면 업장) 타입 비중 < 5%면 감점(0%에 가까울수록 세게). 스시야 레드 등.
    if (unified && typeShares && Object.keys(typeShares).length) {
      const tShare = typeShares[bucketLabel(bucket) || ''] || 0;
      if (tShare < 0.05) {
        const pen = Math.round(40 * (1 - tShare / 0.05) * 10) / 10;
        score -= pen;
        tags.push('비주력타입');
        breakdown.push(`비주력타입 ${Math.round(tShare * 100)}% → -${pen}`);
      }
    }
    if (unified) {
      if (score <= 0) continue; // 아무 축도 안 맞음 → 후보 아님
      // 거래처 본인 이력(산지·취향·견적)이 조금이라도 기여 → 거래처이력, 순수 세그먼트만 → 동종업장.
      tags.push(persScore > 0 ? '거래처이력' : '동종업장');
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
  // 프리미엄(초고가 트랙)은 주력을 밀어내지 않게 상위 MAX_PREMIUM개만 유지.
  const MAX_PREMIUM = 2;
  if (mode !== 'substitute') {
    let kept = 0;
    return scored.filter((it) => (it.tags.includes('프리미엄') ? ++kept <= MAX_PREMIUM : true));
  }
  return scored;
}

// 견적 표시 순서: 타입 그룹 → 국가 우선순위 → 각 타입 내 공급가 내림차순 (displayOrder.ts 공용)
export function orderForDisplay(items: ScoredItem[]): ScoredItem[] {
  return [...items].sort(compareForDisplay);
}

// 후보 품종 중 거래처 선호품종과 겹친 것의 한글/원문 라벨
function matchedGrapeLabel(invGrapes: string, prefs: ClientPreferences): string {
  const gl = invGrapes.toLowerCase();
  for (const [g] of prefs.topGrapes) {
    if (gl.includes(g.toLowerCase())) return g;
  }
  return invGrapes.split(/[,\/]/)[0]?.trim() || '품종';
}
