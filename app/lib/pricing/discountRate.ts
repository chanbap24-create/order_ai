// app/lib/pricing/discountRate.ts
// 거래처 할인율 공식 (가격공식.xlsx 기준, 모든 금액은 공급가 기준)
//
// 할인율 = 기본할인률 + 매출등급 가산 + 수량/품목등급 가산 (+ 리델 5%, 업소/호텔만)
//   · 기본할인률: 업소/호텔 10%, 샵 10%, 도매장 15%(공급가 10만 미만) / 10%(공급가 10만 이상)
//   · 매출등급: 분기(3개월) 공급가 매출 기준. 업태별 구간. 도매장은 없음.
//   · 수량등급:
//       - 업소/호텔 = 분기 리스팅 품목수(거래처 단위)
//       - 샵·도매장 = 한 거래에서 같은 품목 매입 병수(품목 단위)
//   · 리델: 전분기 리델 거래가 있던 거래처, 업소/호텔 한정 +5%
//
// 매출·수량 등급은 서로 독립. 각 축에서 달성한 '가장 높은 등급'의 가산만 더한다.

export type VenueCategory = 'venue' | 'shop' | 'wholesale'; // 업소/호텔, 샵, 도매장

interface Tier { min: number; add: number }

// 기본할인률(공급가 기준)
const BASE_FLAT: Record<'venue' | 'shop', number> = { venue: 0.10, shop: 0.10 };
const WHOLESALE_PRICE_THRESHOLD = 100_000; // 공급가 10만원
const WHOLESALE_BASE_LOW = 0.15;  // 10만 미만
const WHOLESALE_BASE_HIGH = 0.10; // 10만 이상

// 매출등급(분기 공급가 매출) → 가산. 내림차순(높은 등급 우선).
const SALES_TIERS: Record<VenueCategory, Tier[]> = {
  venue: [{ min: 3_000_000, add: 0.08 }, { min: 2_000_000, add: 0.04 }],
  shop: [{ min: 7_000_000, add: 0.10 }, { min: 4_000_000, add: 0.05 }],
  wholesale: [],
};

// 업소/호텔 리스팅 품목수 → 가산 (거래처 단위)
const LISTING_TIERS: Tier[] = [{ min: 10, add: 0.05 }, { min: 5, add: 0.02 }];

// 샵/도매 같은 품목 매입 병수 → 가산 (품목 단위). 내림차순.
const QTY_TIERS: Record<'shop' | 'wholesale', Tier[]> = {
  shop: [{ min: 36, add: 0.10 }, { min: 12, add: 0.05 }],
  wholesale: [{ min: 60, add: 0.15 }, { min: 36, add: 0.10 }, { min: 12, add: 0.05 }],
};

const RIEDEL_ADD = 0.05; // 업소/호텔 전용

/** 내림차순 tier 배열에서 값이 도달한 최고 등급의 가산을 반환 (없으면 0) */
function tierAdd(tiers: Tier[], value: number): { add: number; min: number | null } {
  for (const t of tiers) {
    if (value >= t.min) return { add: t.add, min: t.min };
  }
  return { add: 0, min: null };
}

/** 도매장 기본할인률: 품목 공급가에 따라 가변 */
function wholesaleBase(supplyPrice: number): number {
  return supplyPrice >= WHOLESALE_PRICE_THRESHOLD ? WHOLESALE_BASE_HIGH : WHOLESALE_BASE_LOW;
}

export interface ClientPricingContext {
  category: VenueCategory;
  quarterlySalesSupply: number;  // 분기 공급가 매출
  listingCount: number;          // 분기 리스팅 품목수 (업소/호텔용)
  hadRiedelLastQuarter: boolean; // 전분기 리델 거래 (업소/호텔용)
}

export interface ItemDiscountResult {
  rate: number; // 최종 할인율 (0~1)
  breakdown: { base: number; sales: number; quantity: number; riedel: number };
  appliedQtyMin: number | null; // 적용된 수량등급 기준 병수 (샵/도매)
}

/**
 * 품목 한 라인의 할인율 계산.
 * @param ctx  거래처 단위 컨텍스트(업태, 분기매출, 리스팅수, 리델여부)
 * @param item 품목 단위 값(공급가, 매입 병수)
 */
export function computeItemDiscount(
  ctx: ClientPricingContext,
  item: { supplyPrice: number; qty: number },
): ItemDiscountResult {
  const { category } = ctx;

  // 1. 기본할인률
  const base = category === 'wholesale'
    ? wholesaleBase(item.supplyPrice)
    : BASE_FLAT[category];

  // 2. 매출등급 (거래처 단위)
  const sales = tierAdd(SALES_TIERS[category], ctx.quarterlySalesSupply).add;

  // 3. 수량/품목등급
  let quantity = 0;
  let appliedQtyMin: number | null = null;
  if (category === 'venue') {
    // 리스팅 품목수(거래처 단위)
    quantity = tierAdd(LISTING_TIERS, ctx.listingCount).add;
  } else {
    // 같은 품목 매입 병수(품목 단위) — 도달한 최고 등급을 라인에 적용
    const hit = tierAdd(QTY_TIERS[category], item.qty);
    quantity = hit.add;
    appliedQtyMin = hit.min;
  }

  // 4. 리델 (업소/호텔 전용)
  const riedel = category === 'venue' && ctx.hadRiedelLastQuarter ? RIEDEL_ADD : 0;

  const rate = round2(base + sales + quantity + riedel);
  return { rate, breakdown: { base, sales, quantity, riedel }, appliedQtyMin };
}

export interface QtyRecommendation {
  quantity: number; // 추천 매입 병수(최대 티어)
  remarks: string;  // 비고: 하위 티어들 ("12병 +5%" 등)
}

/**
 * 샵·도매 추천 수량 = 수량등급의 '최대(top) 티어' 병수. 하위 티어는 비고 문구로.
 * 업소/호텔(venue)은 수량등급이 없어 null.
 */
export function maxQtyTierFor(category: VenueCategory): QtyRecommendation | null {
  if (category === 'venue') return null;
  const tiers = QTY_TIERS[category]; // 내림차순 → [0]이 최대
  if (!tiers.length) return null;
  const lower = tiers.slice(1); // 최대 티어 제외 = 하위 티어들
  const remarks = [...lower]
    .sort((a, b) => a.min - b.min)
    .map((t) => `${t.min}병 +${Math.round(t.add * 100)}%`)
    .join(' / ');
  return { quantity: tiers[0].min, remarks };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
