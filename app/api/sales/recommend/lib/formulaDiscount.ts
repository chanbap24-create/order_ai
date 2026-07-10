// 추천견적 할인율 — 가격공식(discountRate.ts) 기반.
// 거래처 업태(업장 태그) + 직전 완료 분기의 공급가 매출·리스팅수 + 직전 반기 리델 거래로
// 품목별 할인율(rec_discount)을 확정. 샵·도매는 최대 수량티어를 추천수량으로,
// 하위 티어는 비고(rec_note)에 표기.
//
// 컨텍스트(업태·분기지표·리델)는 스코어링 전에 buildPricingContext로 1회 계산해
// (1) 후보 '할인가' 산출(가격 게이트용) (2) 최종 rec_discount 부여에 재사용한다.
import { supabase } from '@/app/lib/db';
import { computeItemDiscount, maxQtyTierFor, type ClientPricingContext, type VenueCategory } from '@/app/lib/pricing/discountRate';
import { prevYearRange } from '@/app/lib/pricing/quarters';
import type { QuarterMetrics } from '@/app/lib/pricing/clientGrade';
import { extractRDCode } from '@/app/lib/resolve-glass-items/rdCode';

/** 직전 1년 리델 거래 여부 — 업소/호텔 +5% 판정. glass_shipments의 RD코드 품목 기준. */
async function hadRiedelInPrevYear(clientCode: string): Promise<boolean> {
  const { start, end } = prevYearRange();
  const { data } = await supabase
    .from('glass_shipments')
    .select('item_name')
    .eq('client_code', clientCode)
    .gte('ship_date', start)
    .lt('ship_date', end);
  for (const r of (data || []) as Array<{ item_name?: string }>) {
    if (extractRDCode(r.item_name || '')) return true;
  }
  return false;
}

/** 스코어링 전 1회 계산: 업태 + 직전분기 매출/리스팅 + 직전반기 리델. */
export async function buildPricingContext(
  clientCode: string,
  category: VenueCategory,
  metrics: QuarterMetrics,
): Promise<ClientPricingContext> {
  const hadRiedelLastQuarter = category === 'venue' ? await hadRiedelInPrevYear(clientCode) : false;
  return {
    category,
    quarterlySalesSupply: metrics.salesSupply,
    listingCount: metrics.itemCount,
    hadRiedelLastQuarter,
  };
}

/** 할인율을 할인공급가 하한(floor)으로 클램프(할인가가 그 아래로 안 내려감). */
function clampRate(rate: number, supply: number, floor: number): number {
  if (floor > 0 && supply > 0) {
    const maxRate = Math.floor(((supply - floor) / supply) * 100) / 100; // 내림 → 하한 안 넘음
    if (rate > maxRate) return Math.max(0, maxRate);
  }
  return rate;
}

/** 할인가 = 공급가 × (1 − 할인율), 할인공급가 하한 반영. 가격 게이트/표시용. */
export function discountedPriceFor(
  ctx: ClientPricingContext,
  supply: number,
  qty: number,
  floor = 0,
): number {
  const rate = clampRate(computeItemDiscount(ctx, { supplyPrice: supply, qty }).rate, supply, floor);
  return Math.round(supply * (1 - rate));
}

/**
 * 추천 결과에 공식 기반 할인율 부여(스코어링 후). ctx는 buildPricingContext 결과 재사용.
 *   · 샵·도매: 추천수량(rec_quantity)=최대 티어, 비고(rec_note)=하위 티어.
 *   · 할인가 하한(floorOf) 반영.
 */
export function applyFormulaDiscounts(
  scored: Array<{ item_no: string; price?: number; rec_discount?: number; rec_quantity?: number; rec_note?: string }>,
  ctx: ClientPricingContext,
  floorOf?: (itemNo: string) => number,
): void {
  const qtyRec = maxQtyTierFor(ctx.category);
  for (const s of scored) {
    const supply = Number(s.price) || 0;
    const qty = qtyRec ? qtyRec.quantity : 1;
    const floor = floorOf ? floorOf(s.item_no) : 0;
    s.rec_discount = clampRate(computeItemDiscount(ctx, { supplyPrice: supply, qty }).rate, supply, floor);
    if (qtyRec) {
      s.rec_quantity = qtyRec.quantity;
      if (qtyRec.remarks) s.rec_note = qtyRec.remarks;
    }
  }
}
