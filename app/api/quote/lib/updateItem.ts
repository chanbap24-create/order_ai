/**
 * quote_items 수정/재정렬 로직. PATCH /api/quote 에서 호출.
 */

import { supabase } from '@/app/lib/db';

const ALLOWED_FIELDS = [
  'item_code', 'country', 'brand', 'region', 'image_url', 'spec', 'vintage',
  'product_name', 'english_name', 'korean_name',
  'supply_price', 'retail_price', 'discount_rate', 'discounted_price', 'quantity', 'note', 'tasting_note',
];

/**
 * bulk reorder: sort_order 만 갱신. 병렬 update 로 N번 RTT → 단일 Promise.all.
 */
export async function reorderQuoteItems(items: { id: number; sort_order: number }[]) {
  await Promise.all(
    items.map((it) =>
      supabase.from('quote_items').update({ sort_order: it.sort_order }).eq('id', it.id),
    ),
  );
  return { success: true };
}

/**
 * 단일 row 업데이트. update + select 를 한 쿼리로 체이닝하여 RTT 1회 절약.
 */
export async function updateQuoteItem(id: number | string, fields: Record<string, unknown>) {
  const { data: existing } = await supabase
    .from('quote_items')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!existing) {
    return { status: 404, body: { error: '항목을 찾을 수 없습니다.' } };
  }

  const updateData: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in fields) updateData[field] = fields[field];
  }
  if (Object.keys(updateData).length === 0) {
    return { status: 400, body: { error: '수정할 필드가 없습니다.' } };
  }

  // discounted_price: 사용자가 직접 입력한 값이 있으면 그대로 존중(임의 할인가 허용).
  // 없을 때만 공급가×(1-할인율)로 재계산(공급가·할인율만 바뀐 경우).
  if ('discounted_price' in fields) {
    updateData.discounted_price = Math.round(Number(fields.discounted_price) || 0);
  } else if ('supply_price' in fields || 'discount_rate' in fields) {
    const newPrice = 'supply_price' in fields ? Number(fields.supply_price) : existing.supply_price;
    const newRate = 'discount_rate' in fields ? Number(fields.discount_rate) : existing.discount_rate;
    updateData.discounted_price = Math.round(newPrice * (1 - newRate));
  }
  updateData.updated_at = new Date().toISOString();

  const { data: updated } = await supabase
    .from('quote_items')
    .update(updateData)
    .eq('id', id)
    .select()
    .maybeSingle();

  return { status: 200, body: { success: true, item: updated } };
}
