// 권장 할인율: 영업범위(영업1부 또는 나머지)의 최근 6개월 출고 기반.
// 1순위: 품목별 '가장 많이 나간 판매가(최빈 selling_price)'가 일정 건수 이상이면 그 할인율.
// 2순위: 건수 미달이거나 이력 없으면 '같은 가격대'의 신뢰 품목 할인율 중앙값으로 폴백.
// 3순위: 가격대 표본도 없으면 전체 중앙값. 그래도 없으면 권장 없음(빈칸=견적 0%).
import { supabase } from '@/app/lib/db';

const MAX_DISC = 0.6;
const MIN_N = 3; // 최빈가가 이 건수 미만이면 신뢰X → 가격대 폴백(통계 표본에서도 제외)
export const SALES_TEAM_1 = ['조성재', '김효직', '김기범', '성창우', '하홍집', '김동현'];
export type DiscountScope = 'team1' | 'rest';

const clamp = (d: number) => (d < 0 ? 0 : d > MAX_DISC ? MAX_DISC : d);
// 할인율은 정수%로 반올림 → 화면 할인율(정수%)과 할인가(공급가×(1-할인))가 항상 일치
const roundPct = (n: number) => Math.round(n * 100) / 100;
function since6mo(): string {
  const d = new Date(); d.setMonth(d.getMonth() - 6);
  return d.toISOString().slice(0, 10);
}

// 가격대 버킷(앱 전반의 가격 계단과 동일): 30만↑/20만/10만/5만/2만/2만↓
function bandOf(supply: number): string {
  if (supply >= 300000) return 'p300';
  if (supply >= 200000) return 'p200';
  if (supply >= 100000) return 'p100';
  if (supply >= 50000) return 'p50';
  if (supply >= 20000) return 'p20';
  return 'p0';
}
function median(xs: number[]): number {
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

type ExactDeal = { d: number; qty: number }; // 자기 할인율 + 최빈 수량(같이 나간 묶음)
type DiscountTables = {
  exact: Map<string, ExactDeal>; // 건수 충분한 품목의 자기 할인율·최빈 수량
  band: Map<string, number>;     // 가격대별 할인율 중앙값(신뢰 품목 기준)
  global: number | null;         // 전체 중앙값(최후 폴백)
};

/** 영업범위 6개월 출고에서 (1)신뢰 품목 할인·최빈수량 (2)가격대 중앙값 (3)전체 중앙값 테이블 구성. */
async function getDiscountTables(scope: DiscountScope): Promise<DiscountTables> {
  const { data } = await supabase.rpc('item_modal_price', {
    managers: SALES_TEAM_1, since: since6mo(), exclude: scope === 'rest',
  });
  const exact = new Map<string, ExactDeal>();
  const bandVals = new Map<string, number[]>();
  const allVals: number[] = [];
  for (const r of (data || []) as Array<{ item_no: string; modal_price: number; modal_qty: number; supply_price: number; n: number }>) {
    const supply = Number(r.supply_price) || 0;
    const modal = Number(r.modal_price) || 0;
    const n = Number(r.n) || 0;
    if (supply <= 0 || modal <= 0) continue;
    if (n < MIN_N) continue; // 건수 미달 → 자기 할인도 안 쓰고 폴백 통계에서도 제외
    const d = roundPct(clamp(1 - modal / supply));
    const qty = Number(r.modal_qty) || 0;
    exact.set(String(r.item_no), { d, qty });
    const b = bandOf(supply);
    const arr = bandVals.get(b); if (arr) arr.push(d); else bandVals.set(b, [d]);
    allVals.push(d);
  }
  const band = new Map<string, number>();
  for (const [b, xs] of bandVals) band.set(b, roundPct(median(xs)));
  const global = allVals.length ? roundPct(median(allVals)) : null;
  return { exact, band, global };
}

/**
 * 추천 결과에 권장 할인율(+최빈 수량) 부여.
 * 건수 충분 → 자기 할인·수량 / 미달·이력없음 → 같은 가격대 중앙값 → 전체 중앙값 → 없음(0%).
 * 수량은 신뢰 품목만 부여(폴백은 수량 미상 → 기본 1병).
 */
export async function applyRecommendedDiscounts(
  scored: Array<{ item_no: string; price?: number; rec_discount?: number; rec_quantity?: number }>,
  scope: DiscountScope,
): Promise<void> {
  const { exact, band, global } = await getDiscountTables(scope);
  for (const s of scored) {
    const own = exact.get(s.item_no);
    if (own != null) {
      s.rec_discount = own.d;
      if (own.qty > 0) s.rec_quantity = own.qty;
      continue;
    }
    const b = bandOf(Number(s.price) || 0);
    const fb = band.get(b);
    s.rec_discount = fb != null ? fb : (global != null ? global : undefined);
  }
}
