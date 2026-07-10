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
  memo: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PromotionInput {
  corporation?: string;
  item_no: string;
  item_name?: string | null;
  quantity?: number | null;
  discount_rate?: number | null;
  discount_price?: number | null;
  memo?: string | null;
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

function clampRate(r: number | null | undefined): number | null {
  if (r === null || r === undefined) return null;
  const n = Number(r);
  if (!Number.isFinite(n)) return null;
  return Math.min(1, Math.max(0, n));
}
