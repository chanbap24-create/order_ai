// 권장 할인율: 영업범위(영업1부 또는 나머지)의 최근 6개월 출고 기반.
// 품목별 '가장 많이 나간 판매가(최빈 selling_price)' → 할인 = 1 - 최빈판매가/공급가.
// 판매 이력이 없는 품목은 추측하지 않음(권장 없음=빈칸, 견적 0%). 견적 자동입력용.
import { supabase } from '@/app/lib/db';

const MAX_DISC = 0.6;
export const SALES_TEAM_1 = ['조성재', '김효직', '김기범', '성창우', '하홍집', '김동현'];
export type DiscountScope = 'team1' | 'rest';

const clamp = (d: number) => (d < 0 ? 0 : d > MAX_DISC ? MAX_DISC : d);
// 할인율은 정수%로 반올림 → 화면 할인율(정수%)과 할인가(공급가×(1-할인))가 항상 일치(예: 10% → 184,500)
const roundPct = (n: number) => Math.round(n * 100) / 100;
function since6mo(): string {
  const d = new Date(); d.setMonth(d.getMonth() - 6);
  return d.toISOString().slice(0, 10);
}

/** 품목별 권장 할인(영업범위 6개월 최빈 판매가 기준). 이력 없는 품목은 맵에 없음. */
async function getItemDiscounts(scope: DiscountScope): Promise<Map<string, number>> {
  const { data } = await supabase.rpc('item_modal_price', {
    managers: SALES_TEAM_1, since: since6mo(), exclude: scope === 'rest',
  });
  const out = new Map<string, number>();
  for (const r of (data || []) as Array<{ item_no: string; modal_price: number; supply_price: number }>) {
    const supply = Number(r.supply_price) || 0;
    const modal = Number(r.modal_price) || 0;
    if (supply > 0 && modal > 0) out.set(String(r.item_no), roundPct(clamp(1 - modal / supply)));
  }
  return out;
}

/** 추천 결과에 권장 할인율 부여. 판매 이력 없는 품목은 미부여(빈칸=견적 0%). */
export async function applyRecommendedDiscounts(
  scored: Array<{ item_no: string; rec_discount?: number }>,
  scope: DiscountScope,
): Promise<void> {
  const itemMap = await getItemDiscounts(scope);
  for (const s of scored) s.rec_discount = itemMap.get(s.item_no);
}
