// 매장 직원 → 소믈리에 관리자 수정 요청 (서버 전용).
// 생성 시 품번으로 정식 한글/영문명을 붙이고, 관리자(소믈리에 권한자) 중 텔레그램 연동 계정에 알림.
import { supabase } from './db';
import { DISCOUNT_EDITORS } from './sommelierDiscount';
import { escapeHtml, sendTelegram } from './telegram';
import { storeViewLabel, type StoreView } from './store/types';
import { logger } from './logger';

import { REQUEST_CATEGORIES, type ChangeRequest, type RequestCategory } from './sommelierRequestTypes';

export { REQUEST_CATEGORIES, type ChangeRequest, type RequestCategory } from './sommelierRequestTypes';

const storeLabelOf = (key: string | null) => (key ? storeViewLabel(key as StoreView) : '');

/** 요청 생성 + 관리자 알림. 이름은 wines 정식명 우선, 없으면 화면에 보이던 이름. */
export async function createChangeRequest(input: {
  itemNo: string; itemName: string; category: RequestCategory; message: string;
  storeKey: string | null; requester: string;
}): Promise<ChangeRequest> {
  const { data: w } = await supabase.from('wines')
    .select('item_name_kr, item_name_en').eq('item_code', input.itemNo).maybeSingle();

  const { data, error } = await supabase.from('sommelier_change_requests').insert({
    item_no: input.itemNo,
    item_name_kr: w?.item_name_kr || input.itemName || null,
    item_name_en: w?.item_name_en || null,
    category: input.category,
    message: input.message || null,
    store_key: input.storeKey,
    requester: input.requester,
  }).select('*').single();
  if (error) throw error;

  await notifyAdmins(data as ChangeRequest);
  return data as ChangeRequest;
}

/** 소믈리에 관리자(박경아·조성재·admin) 중 텔레그램 연동 계정에 발송. 실패해도 요청은 유지. */
async function notifyAdmins(r: ChangeRequest) {
  const { data: users } = await supabase.from('sales_users')
    .select('manager, telegram_chat_id')
    .or(`role.eq.admin,manager.in.(${DISCOUNT_EDITORS.join(',')})`)
    .not('telegram_chat_id', 'is', null);
  if (!users?.length) return;

  const when = new Date(new Date(r.created_at).getTime() + 9 * 3600_000).toISOString().slice(5, 16).replace('T', ' ');
  const html = [
    `<b>[소믈리에 수정요청] ${escapeHtml(REQUEST_CATEGORIES[r.category])}</b>`,
    `${escapeHtml(r.item_no)} · ${escapeHtml(r.item_name_kr || '')}`,
    r.item_name_en ? `<i>${escapeHtml(r.item_name_en)}</i>` : '',
    r.message ? `“${escapeHtml(r.message)}”` : '',
    `요청: ${escapeHtml(r.requester)}${r.store_key ? ` (${escapeHtml(storeLabelOf(r.store_key))})` : ''} · ${when}`,
  ].filter(Boolean).join('\n');

  for (const u of users) {
    const res = await sendTelegram(String(u.telegram_chat_id), html);
    if (!res.ok) logger.warn(`[sommelierRequests] 알림 실패 ${u.manager}: ${res.error}`);
  }
}

/** 관리자 목록 — 미처리 먼저, 최근 처리 30건까지 */
export async function listChangeRequests(): Promise<ChangeRequest[]> {
  const [{ data: open }, { data: done }] = await Promise.all([
    supabase.from('sommelier_change_requests').select('*').eq('status', 'open').order('created_at', { ascending: false }),
    supabase.from('sommelier_change_requests').select('*').eq('status', 'done').order('resolved_at', { ascending: false }).limit(30),
  ]);
  return [...(open || []), ...(done || [])] as ChangeRequest[];
}

/** 처리 완료/되돌리기 */
export async function setChangeRequestStatus(id: number, done: boolean, by: string): Promise<void> {
  const { error } = await supabase.from('sommelier_change_requests').update(done
    ? { status: 'done', resolved_at: new Date().toISOString(), resolved_by: by }
    : { status: 'open', resolved_at: null, resolved_by: null }).eq('id', id);
  if (error) throw error;
}

