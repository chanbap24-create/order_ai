// app/lib/promotions.ts
// 프로모션 규칙: 특정 품목의 수량·할인률·할인가를 고정. AI 추천견적에서 최상위 규칙으로 적용.
import { supabase } from './db';

export interface Promotion {
  id: string;
  corporation: string;   // CDV/DL
  item_no: string;
  item_name: string | null;
  quantity: number | null;
  discount_rate: number | null;  // 0~1
  discount_price: number | null; // 할인가(표시/참고)
  active: boolean;
  always_recommend: boolean;     // 견적발행 시 무조건 추천(후보에 없어도 주입)
  categories: string[] | null;   // 대상 업태(venue/shop/wholesale). null·빈배열 = 전체
  memo: string | null;
  created_at?: string;
  updated_at?: string;
  // 재고(표시용, enrichWithStock에서 부착)
  total_stock?: number;
  available_stock?: number;
  bonded_warehouse?: number;
}

export interface PromotionInput {
  corporation?: string;
  item_no: string;
  item_name?: string | null;
  quantity?: number | null;
  discount_rate?: number | null;
  discount_price?: number | null;
  always_recommend?: boolean;
  categories?: string[] | null;
  memo?: string | null;
}

const CATEGORY_KEYS = ['venue', 'shop', 'wholesale'];
/** 업태 배열 정규화 — 화이트리스트 외 제거, 빈배열이면 null(전체). */
function sanitizeCategories(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out = [...new Set(raw.map(String).filter((c) => CATEGORY_KEYS.includes(c)))];
  return out.length ? out : null;
}

/** 법인 프로모션 전체(관리 화면용, 활성/비활성 모두). */
export async function listPromotions(corporation = 'CDV'): Promise<Promotion[]> {
  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .eq('corporation', corporation)
    .order('active', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Promotion[];
}

/** 활성 프로모션을 item_no → Promotion 맵으로(추천 통합용). */
export async function getActivePromotions(corporation = 'CDV'): Promise<Map<string, Promotion>> {
  const { data } = await supabase
    .from('promotions')
    .select('*')
    .eq('corporation', corporation)
    .eq('active', true);
  const m = new Map<string, Promotion>();
  for (const p of (data || []) as Promotion[]) m.set(String(p.item_no), p);
  return m;
}

/** 프로모션 생성. 같은 법인·품목의 기존 활성 프로모션은 비활성 처리 후 새로 추가(활성 유니크 보장). */
export async function createPromotion(input: PromotionInput): Promise<Promotion> {
  const corp = input.corporation || 'CDV';
  const item_no = String(input.item_no || '').trim();
  if (!item_no) throw new Error('item_no가 필요합니다.');
  const rate = clampRate(input.discount_rate);

  await supabase.from('promotions')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('corporation', corp).eq('item_no', item_no).eq('active', true);

  const { data, error } = await supabase.from('promotions').insert({
    corporation: corp,
    item_no,
    item_name: input.item_name ?? null,
    quantity: input.quantity ?? null,
    discount_rate: rate,
    discount_price: input.discount_price ?? null,
    always_recommend: input.always_recommend ?? true,
    categories: sanitizeCategories(input.categories),
    memo: input.memo ?? null,
    active: true,
  }).select('*').single();
  if (error) throw error;
  return data as Promotion;
}

/** 프로모션 수정(수량·할인률·할인가·활성·메모). */
export async function updatePromotion(id: string, patch: Partial<PromotionInput> & { active?: boolean }): Promise<Promotion> {
  if (!id) throw new Error('id가 필요합니다.');
  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.quantity !== undefined) upd.quantity = patch.quantity;
  if (patch.discount_rate !== undefined) upd.discount_rate = clampRate(patch.discount_rate);
  if (patch.discount_price !== undefined) upd.discount_price = patch.discount_price;
  if (patch.always_recommend !== undefined) upd.always_recommend = patch.always_recommend;
  if (patch.categories !== undefined) upd.categories = sanitizeCategories(patch.categories);
  if (patch.memo !== undefined) upd.memo = patch.memo;
  if (patch.active !== undefined) upd.active = patch.active;
  const { data, error } = await supabase.from('promotions').update(upd).eq('id', id).select('*').single();
  if (error) throw error;
  return data as Promotion;
}

export async function deletePromotion(id: string): Promise<void> {
  if (!id) throw new Error('id가 필요합니다.');
  const { error } = await supabase.from('promotions').delete().eq('id', id);
  if (error) throw error;
}

/** 재고(총재고·가용재고·보세) 부착 — 관리 화면 표시용(inventory_cdv 기준). */
export async function enrichWithStock(promos: Promotion[]): Promise<Promotion[]> {
  const codes = [...new Set(promos.map((p) => p.item_no))];
  if (codes.length === 0) return promos;
  const stockMap = new Map<string, { total_stock?: number; available_stock?: number; bonded_warehouse?: number }>();
  for (let i = 0; i < codes.length; i += 500) {
    const { data } = await supabase
      .from('inventory_cdv')
      .select('item_no, total_stock, available_stock, bonded_warehouse')
      .in('item_no', codes.slice(i, i + 500));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of (data || []) as any[]) stockMap.set(String(r.item_no), r);
  }
  return promos.map((p) => {
    const s = stockMap.get(p.item_no);
    return {
      ...p,
      total_stock: s?.total_stock ?? 0,
      available_stock: s?.available_stock ?? 0,
      bonded_warehouse: s?.bonded_warehouse ?? 0,
    };
  });
}

function clampRate(r: number | null | undefined): number | null {
  if (r === null || r === undefined) return null;
  const n = Number(r);
  if (!Number.isFinite(n)) return null;
  return Math.min(1, Math.max(0, n));
}
