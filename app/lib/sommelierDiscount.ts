// 소믈리에 백화점 할인 밴드 — 가격대별 할인율 로드·적용 (서버 전용).
// 정상 판매가(retail)는 실판매가가 아니라서, 권한자가 밴드별 할인율을 설정하면
// 추천 카드에 정상가 → 할인가로 노출된다. 할인가는 100원 단위 내림.
import { supabase } from './db';

export type DiscountBand = {
  id: number;
  min_price: number;
  max_price: number | null; // 미만 경계, null = 무제한
  rate: number;             // 할인율 %
};

/** 조정 권한자 — 세션 manager 이름 기준 (admin 롤은 항상 허용) */
export const DISCOUNT_EDITORS = ['박경아', '조성재'];

export function canEditDiscounts(session: { manager: string; role: string } | null): boolean {
  if (!session) return false;
  if (session.role === 'admin') return true;
  return DISCOUNT_EDITORS.includes(session.manager);
}

export async function loadDiscountBands(): Promise<DiscountBand[]> {
  const { data } = await supabase
    .from('sommelier_discount_bands')
    .select('id, min_price, max_price, rate')
    .order('min_price');
  return (data || []).map((b) => ({
    id: b.id,
    min_price: Number(b.min_price) || 0,
    max_price: b.max_price == null ? null : Number(b.max_price),
    rate: Number(b.rate) || 0,
  }));
}

/** 정상가 → {할인가, 적용 할인율}. 해당 밴드가 없거나 rate=0이면 정상가 그대로. */
export function saleOf(retail: number, bands: DiscountBand[]): { sale: number; rate: number } {
  const band = bands.find((b) => retail >= b.min_price && (b.max_price == null || retail < b.max_price));
  const rate = band?.rate || 0;
  if (rate <= 0) return { sale: retail, rate: 0 };
  const sale = Math.floor((retail * (1 - rate / 100)) / 100) * 100; // 100원 단위 내림
  return { sale: Math.max(sale, 0), rate };
}
