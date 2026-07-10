// 추천견적 할인율 — 가격공식(discountRate.ts) 기반.
// 거래처 업태(업장 태그) + 직전 완료 분기의 공급가 매출·리스팅수 + 직전 반기 리델 거래로
// 품목별 할인율(rec_discount)을 확정. 샵·도매는 최대 수량티어를 추천수량으로,
// 하위 티어는 비고(rec_note)에 표기.
//
// 기준(사용자 확정):
//   · 분기 = 캘린더 분기(1~3/4~6/7~9/10~12월). '직전 완료 분기'의 Σ(공급가 × 수량) = 매출등급.
//   · 리스팅 품목수 = 같은 직전 분기의 고유 품번 수.
//   · 리델 = '직전 반기(H1 1~6월 / H2 7~12월)'에 RD코드 글라스 거래가 있으면 true(업소/호텔만).
//   · 수량등급 = 최대 티어 적용(추천수량=최대티어 병수), 하위 티어는 비고.
import { supabase } from '@/app/lib/db';
import { computeItemDiscount, maxQtyTierFor, type ClientPricingContext } from '@/app/lib/pricing/discountRate';
import { venueKeyToCategory } from '@/app/lib/pricing/venueCategory';
import { extractRDCode } from '@/app/lib/resolve-glass-items/rdCode';

function ymd(y: number, month0: number, day: number): string {
  return `${y}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** 직전 완료 분기 [start, end) — end는 현재 분기 시작일(경계 제외). */
function prevQuarterRange(now = new Date()): { start: string; end: string } {
  const y = now.getFullYear();
  const q = Math.floor(now.getMonth() / 3); // 0..3 (현재 분기)
  const end = ymd(y, q * 3, 1);             // 현재 분기 시작 = 직전 분기 종료(제외)
  const py = q === 0 ? y - 1 : y;
  const pStartMonth = q === 0 ? 9 : (q - 1) * 3;
  return { start: ymd(py, pStartMonth, 1), end };
}

/** 직전 완료 반기 [start, end) — end는 현재 반기 시작일(경계 제외). */
function prevHalfRange(now = new Date()): { start: string; end: string } {
  const y = now.getFullYear();
  const h = now.getMonth() < 6 ? 0 : 1; // 0=H1(1~6월), 1=H2(7~12월)
  const end = ymd(y, h * 6, 1);          // 현재 반기 시작 = 직전 반기 종료(제외)
  const py = h === 0 ? y - 1 : y;
  const pStartMonth = h === 0 ? 6 : 0;
  return { start: ymd(py, pStartMonth, 1), end };
}

/** 직전 반기 리델 거래 여부 — 업소/호텔 +5% 판정. glass_shipments의 RD코드 품목 기준. */
async function hadRiedelInPrevHalf(clientCode: string): Promise<boolean> {
  const { start, end } = prevHalfRange();
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

export interface FormulaDiscountInput {
  clientCode: string;
  venueKey: string | null | undefined;
  // 최근 프로파일 기간(profileMonths, 기본 6개월) 출고 — 직전 분기 창으로 필터해 매출/리스팅 집계.
  shipments: Array<{ item_no?: string; quantity?: number; ship_date?: string }>;
  priceOf: (itemNo: string) => number; // 품목 공급가
}

/**
 * 추천 결과에 공식 기반 할인율 부여.
 *   · 할인율(rec_discount) = 공식으로 확정(업태 기본 + 매출등급 + 수량등급 + 리델).
 *   · 샵·도매: 추천수량(rec_quantity)=최대 티어 병수, 비고(rec_note)=하위 티어.
 *   · 업소/호텔: 수량등급 없음 → rec_quantity(모달 묶음) 유지, 비고 없음.
 * 반환값은 계산에 쓴 거래처 컨텍스트(디버그/표시용).
 */
export async function applyFormulaDiscounts(
  scored: Array<{ item_no: string; price?: number; rec_discount?: number; rec_quantity?: number; rec_note?: string }>,
  input: FormulaDiscountInput,
): Promise<ClientPricingContext> {
  const category = venueKeyToCategory(input.venueKey);
  const { start: qStart, end: qEnd } = prevQuarterRange();

  // 직전 분기 공급가 매출 + 리스팅 품목수
  let quarterlySalesSupply = 0;
  const listed = new Set<string>();
  for (const s of input.shipments) {
    const d = s.ship_date || '';
    if (d < qStart || d >= qEnd) continue;
    const no = s.item_no ? String(s.item_no) : '';
    if (!no) continue;
    listed.add(no);
    quarterlySalesSupply += input.priceOf(no) * (Number(s.quantity) || 0);
  }

  const hadRiedelLastQuarter = category === 'venue'
    ? await hadRiedelInPrevHalf(input.clientCode)
    : false;

  const ctx: ClientPricingContext = {
    category,
    quarterlySalesSupply,
    listingCount: listed.size,
    hadRiedelLastQuarter,
  };

  // 샵·도매 최대 티어(추천수량 + 하위티어 비고) — 거래처 단위로 1회 계산.
  const qtyRec = maxQtyTierFor(category);

  for (const s of scored) {
    const supply = Number(s.price) || input.priceOf(s.item_no) || 0;
    // 샵·도매는 최대 티어 병수로 할인 계산, 업소/호텔은 수량 무관(리스팅 기준).
    const qty = qtyRec ? qtyRec.quantity : 1;
    const r = computeItemDiscount(ctx, { supplyPrice: supply, qty });
    s.rec_discount = r.rate;
    if (qtyRec) {
      s.rec_quantity = qtyRec.quantity;
      if (qtyRec.remarks) s.rec_note = qtyRec.remarks;
    }
  }
  return ctx;
}
