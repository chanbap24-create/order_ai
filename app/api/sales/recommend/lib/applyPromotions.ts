// 추천 결과에 프로모션 규칙 적용 — 최상위 규칙.
// 프로모션 지정 품목은 (1) 할인률·수량을 프로모션 값으로 강제하고 (2) 최상위로 노출.
// 후보에 없으면(이미 구매·필터 제외 등) 재고에서 주입한다. 할인가(할인공급가) 하한도 무시(프로모션 우선).
import type { ScoredItem } from '@/app/sales/recommend/types';
import { getActivePromotions, type Promotion } from '@/app/lib/promotions';

const PROMO_SCORE = 100000; // 최상위 정렬 보장

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildScored(itemNo: string, inv: any, wine: any): ScoredItem {
  const stock = (inv?.available_stock || 0) + (inv?.bonded_warehouse || 0) + (inv?.bonded_kctc || 0);
  return {
    item_no: itemNo,
    item_name: inv?.item_name || wine?.item_name_kr || itemNo,
    country: wine?.country || wine?.country_en || inv?.country || '',
    region: wine?.region || '',
    grape: wine?.grape_varieties || '',
    wine_type: wine?.wine_type || '',
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

export async function applyPromotions(
  scored: ScoredItem[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawInvMap: Map<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wineMap: Map<string, any>,
  corporation = 'CDV',
): Promise<void> {
  const promos = await getActivePromotions(corporation);
  if (promos.size === 0) return;

  for (const [itemNo, p] of promos) {
    let s = scored.find((x) => x.item_no === itemNo);
    if (!s) {
      // always_recommend=false면 자연 후보일 때만 적용(강제 주입 안 함).
      if (p.always_recommend === false) continue;
      const inv = rawInvMap.get(itemNo);
      if (!inv) continue; // 재고 없음 → 견적 불가, 스킵
      s = buildScored(itemNo, inv, wineMap.get(itemNo));
      scored.push(s);
    }
    // 프로모션 규칙 강제(최상위) — 할인가 하한 클램프도 무시.
    s.promo = true;
    if (p.quantity && p.quantity > 0) s.rec_quantity = p.quantity;
    const rate = promoRate(p, Number(s.price) || 0);
    if (rate !== undefined) s.rec_discount = rate;
    s.rec_note = p.memo ? `프로모션 · ${p.memo}` : '프로모션';
    s.score = PROMO_SCORE;
    s.tags = ['프로모션', ...(s.tags || []).filter((t) => t !== '프로모션')];
  }
}
