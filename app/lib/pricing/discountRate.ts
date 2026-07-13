// app/lib/pricing/discountRate.ts
// 거래처 할인율 공식 (가격공식.xlsx 기준, 모든 금액은 공급가 기준)
//
// 할인율 = 기본할인률 + 매출등급 가산 + 수량/품목등급 가산 (+ 리델 5%, 업소/호텔만)
// 업태별 등급조건은 DiscountConfig로 관리(DB 편집 가능). 기본값은 DEFAULT_DISCOUNT_CONFIG.

export type VenueCategory = 'venue' | 'shop' | 'wholesale'; // 업소/호텔, 샵, 도매장

export interface Tier { min: number; add: number }

export interface DiscountConfig {
  venue: { base: number; sales: Tier[]; listing: Tier[]; riedel: number };
  shop: { base: number; sales: Tier[]; qty: Tier[] };
  wholesale: { baseLow: number; baseHigh: number; priceThreshold: number; qty: Tier[] };
  /** 윈백 가산 — 발주 리듬이 끊긴(휴면·이탈위험) 거래처의 추천견적에 자동 합산. 전 업태 공통. */
  winback: number;
}

// 기본값(가격공식.xlsx). config 미설정 시 사용.
export const DEFAULT_DISCOUNT_CONFIG: DiscountConfig = {
  venue: {
    base: 0.10,
    sales: [{ min: 2_000_000, add: 0.04 }, { min: 3_000_000, add: 0.08 }],
    listing: [{ min: 5, add: 0.02 }, { min: 10, add: 0.05 }],
    riedel: 0.05,
  },
  shop: {
    base: 0.10,
    sales: [{ min: 4_000_000, add: 0.05 }, { min: 7_000_000, add: 0.10 }],
    qty: [{ min: 12, add: 0.05 }, { min: 36, add: 0.10 }],
  },
  wholesale: {
    baseLow: 0.15,   // 공급가 10만 미만
    baseHigh: 0.10,  // 공급가 10만 이상
    priceThreshold: 100_000,
    qty: [{ min: 12, add: 0.05 }, { min: 36, add: 0.10 }, { min: 60, add: 0.15 }],
  },
  winback: 0.05,
};

/** 값이 도달한 tier 중 가장 높은(min이 큰) tier의 가산. 순서 무관. */
function tierAdd(tiers: Tier[], value: number): { add: number; min: number | null } {
  let best: { add: number; min: number | null } = { add: 0, min: null };
  for (const t of tiers) {
    if (value >= t.min && (best.min === null || t.min > best.min)) best = { add: t.add, min: t.min };
  }
  return best;
}

/** tierAdd + 단계업: stepUp이면 도달 티어의 한 단계 위 티어를 적용(최상위면 그대로).
 *  하위거래처 보정(프로모션 제안용) — 미달(0가산) 거래처는 첫 티어 가산을 받는다. */
function tierAddStepped(tiers: Tier[], value: number, stepUp?: boolean): { add: number; min: number | null } {
  if (!stepUp) return tierAdd(tiers, value);
  const asc = [...tiers].sort((a, b) => a.min - b.min);
  let idx = -1;
  for (let i = 0; i < asc.length; i++) if (value >= asc[i].min) idx = i;
  if (idx < asc.length - 1) idx += 1;
  return idx >= 0 ? { add: asc[idx].add, min: asc[idx].min } : { add: 0, min: null };
}

export interface ClientPricingContext {
  category: VenueCategory;
  quarterlySalesSupply: number;  // 분기 공급가 매출
  listingCount: number;          // 분기 리스팅 품목수 (업소/호텔용)
  hadRiedelLastQuarter: boolean; // 전분기 리델 거래 (업소/호텔용)
  config?: DiscountConfig;       // 업태별 등급조건(없으면 기본값)
  /** 발주 리듬 판정(본인 주기 2배=risk/3배=dormant) — 있으면 윈백 가산 자동 합산 */
  winbackStatus?: 'dormant' | 'risk' | null;
  /** 하위거래처 보정(프로모션 제안): 매출등급을 한 단계 위 티어로 취급(업소·샵). 도매는 매출등급이 없어 무영향. */
  salesGradeStepUp?: boolean;
}

export interface ItemDiscountResult {
  rate: number; // 최종 할인율 (0~1)
  breakdown: { base: number; sales: number; quantity: number; riedel: number; winback: number };
  appliedQtyMin: number | null; // 적용된 수량등급 기준 병수 (샵/도매)
}

/** 품목 한 라인의 할인율 계산. config는 ctx.config(없으면 기본값). */
export function computeItemDiscount(
  ctx: ClientPricingContext,
  item: { supplyPrice: number; qty: number },
): ItemDiscountResult {
  const cfg = ctx.config ?? DEFAULT_DISCOUNT_CONFIG;
  let base = 0, sales = 0, quantity = 0, riedel = 0;
  let appliedQtyMin: number | null = null;

  if (ctx.category === 'wholesale') {
    base = item.supplyPrice >= cfg.wholesale.priceThreshold ? cfg.wholesale.baseHigh : cfg.wholesale.baseLow;
    const hit = tierAdd(cfg.wholesale.qty, item.qty);
    quantity = hit.add; appliedQtyMin = hit.min;
  } else if (ctx.category === 'shop') {
    base = cfg.shop.base;
    sales = tierAddStepped(cfg.shop.sales, ctx.quarterlySalesSupply, ctx.salesGradeStepUp).add;
    const hit = tierAdd(cfg.shop.qty, item.qty);
    quantity = hit.add; appliedQtyMin = hit.min;
  } else {
    base = cfg.venue.base;
    sales = tierAddStepped(cfg.venue.sales, ctx.quarterlySalesSupply, ctx.salesGradeStepUp).add;
    quantity = tierAdd(cfg.venue.listing, ctx.listingCount).add;
    riedel = ctx.hadRiedelLastQuarter ? cfg.venue.riedel : 0;
  }

  // 윈백: 발주 리듬이 끊긴 거래처(휴면·이탈위험)에 자동 가산 — 이번 견적 한정 특별가
  const winback = ctx.winbackStatus ? (cfg.winback ?? DEFAULT_DISCOUNT_CONFIG.winback) : 0;

  const rate = round2(base + sales + quantity + riedel + winback);
  return { rate, breakdown: { base, sales, quantity, riedel, winback }, appliedQtyMin };
}

export interface QtyRecommendation {
  quantity: number; // 추천 매입 병수(최대 티어)
  remarks: string;  // 비고: 하위 티어들
}

/** 샵·도매 수량등급 티어(오름차순). 업소/호텔은 빈 배열. 비고의 티어별 할인가 계산용. */
export function qtyTiersFor(
  category: VenueCategory,
  config: DiscountConfig = DEFAULT_DISCOUNT_CONFIG,
): Tier[] {
  if (category === 'venue') return [];
  const tiers = category === 'shop' ? config.shop.qty : config.wholesale.qty;
  return [...tiers].sort((a, b) => a.min - b.min);
}

/** 샵·도매 추천 수량 = 수량등급의 최대 티어 병수. 하위 티어는 비고. 업소/호텔은 null. */
export function maxQtyTierFor(
  category: VenueCategory,
  config: DiscountConfig = DEFAULT_DISCOUNT_CONFIG,
): QtyRecommendation | null {
  if (category === 'venue') return null;
  const tiers = category === 'shop' ? config.shop.qty : config.wholesale.qty;
  if (!tiers.length) return null;
  const asc = [...tiers].sort((a, b) => a.min - b.min);
  const top = asc[asc.length - 1];
  const remarks = asc.slice(0, -1).map((t) => `${t.min}병 +${Math.round(t.add * 100)}%`).join(' / ');
  return { quantity: top.min, remarks };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
