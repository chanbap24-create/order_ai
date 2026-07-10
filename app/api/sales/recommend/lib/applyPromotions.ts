// 추천 결과에 프로모션 규칙 적용.
//   · 프로모션가(할인률·수량)는 품목이 추천되면 '항상' 적용(활성 여부 무관).
//   · 무조건 추천(always_recommend=활성) + 거래처가 그 와인 '타입'을 쓰면 → 타입 배분 무관 강제 포함(promoPin).
//     (타입을 안 쓰면 강제하지 않고, 자연 후보일 때만 노출)
//   · OFF면 강제 주입 안 함(자연 후보일 때만). 어느 경우든 노출되면 프로모션가 적용.
import type { ScoredItem } from '@/app/sales/recommend/types';
import { getActivePromotions, type Promotion } from '@/app/lib/promotions';
import { normalizeType, bucketLabel } from './wineType';

const PROMO_SCORE = 100000; // 최상위 정렬 보장

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function itemBucket(wine: any): string {
  return bucketLabel(normalizeType(wine?.wine_type || '', wine?.item_name_kr || '')) || '기타';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildScored(itemNo: string, inv: any, wine: any): ScoredItem {
  const stock = (inv?.available_stock || 0) + (inv?.bonded_warehouse || 0) + (inv?.bonded_kctc || 0);
  return {
    item_no: itemNo,
    item_name: inv?.item_name || wine?.item_name_kr || itemNo,
    country: wine?.country || wine?.country_en || inv?.country || '',
    region: wine?.region || '',
    grape: wine?.grape_varieties || '',
    wine_type: itemBucket(wine),
    price: inv?.supply_price || 0,
    stock,
    score: PROMO_SCORE,
    tags: ['프로모션'],
    reason: '프로모션 지정 품목',
    image_url: wine?.image_url || '',
    brand: wine?.brand || '',
  };
}

/** 프로모션 할인률: discount_rate 우선, 없으면 discount_price로 역산. */
function promoRate(p: Promotion, supply: number): number | undefined {
  if (p.discount_rate !== null && p.discount_rate !== undefined) return p.discount_rate;
  if (p.discount_price && supply > 0) {
    return Math.max(0, Math.min(1, (supply - p.discount_price) / supply)); // 정밀값 → 견적가가 할인가와 정확히 일치
  }
  return undefined;
}

function applyPromoPricing(s: ScoredItem, p: Promotion): void {
  s.promo = true;
  if (p.quantity && p.quantity > 0) s.rec_quantity = p.quantity;
  const rate = promoRate(p, Number(s.price) || 0);
  if (rate !== undefined) s.rec_discount = rate;
  s.rec_note = p.memo ? `프로모션 · ${p.memo}` : '프로모션';
  s.tags = ['프로모션', ...(s.tags || []).filter((t) => t !== '프로모션')];
}

export async function applyPromotions(
  scored: ScoredItem[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawInvMap: Map<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wineMap: Map<string, any>,
  clientOwnTypes: Set<string>,
  corporation = 'CDV',
): Promise<void> {
  const promos = await getActivePromotions(corporation);
  if (promos.size === 0) return;

  // 거래처가 그 타입을 쓰는지. 이력이 전혀 없으면 판단 불가 → 허용.
  const usesType = (t: string): boolean => clientOwnTypes.size === 0 || clientOwnTypes.has(t);

  for (const [itemNo, p] of promos) {
    let s = scored.find((x) => x.item_no === itemNo);
    const wine = wineMap.get(itemNo);
    const type = itemBucket(wine);

    if (!s) {
      // 자연 후보가 아님 → 강제 주입 여부 판단.
      //   활성 + 사용 타입일 때만 재고에서 주입. (비활성이거나 미사용 타입이면 노출 안 함)
      if (p.always_recommend === false) continue;
      if (!usesType(type)) continue;
      const inv = rawInvMap.get(itemNo);
      if (!inv) continue; // 재고 없음 → 견적 불가
      s = buildScored(itemNo, inv, wine);
      scored.push(s);
      s.promoPin = true;
      s.score = PROMO_SCORE;
    } else if (p.always_recommend !== false && usesType(type)) {
      // 자연 후보 + 활성 + 사용 타입 → 타입 배분에서 탈락하지 않게 강제 포함.
      s.promoPin = true;
      s.score = PROMO_SCORE;
    }

    // 노출되면 프로모션가는 항상 적용(활성 여부 무관).
    applyPromoPricing(s, p);
  }
}
