// 매장 앱 입고 알림 (서버 전용) — 입고 예정 와인에 지정 손님 이름으로 알림 신청 →
// 본사 가용재고(inventory_cdv.available_stock)가 신청 시점보다 늘면 '입고' → 신청한 사원에게 알림.
// 입고 판정은 앱 조회 시(즉시)와 매일 크론(텔레그램 발송) 두 곳에서 같은 checkArrivals를 쓴다.
import { supabase } from '../db';
import { escapeHtml, sendTelegram } from '../telegram';
import { logger } from '../logger';
import { STORES, corpOfStore } from './types';
import { loadArrivals } from './stockView';
import type { RestockAlert } from './restockAlertTypes';

export type { RestockAlert } from './restockAlertTypes';

/** 본사 가용재고 — 입고 예정은 법인 무관 inventory_cdv에만 있다(DL 매장 와인도 동일) */
async function hqAvailable(itemNos: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (let i = 0; i < itemNos.length; i += 150) {
    const { data } = await supabase.from('inventory_cdv')
      .select('item_no, available_stock').in('item_no', itemNos.slice(i, i + 150));
    for (const r of data || []) out.set(String(r.item_no), Math.max(0, Number(r.available_stock) || 0));
  }
  return out;
}

/** 보세(통관 전)·미착 수량 — 입항일 지났을 때 '통관 중'/'지연' 구분, 들어오는 병수 표시용 */
async function hqPipeline(itemNos: string[]): Promise<Map<string, { bonded: number; incoming: number }>> {
  const out = new Map<string, { bonded: number; incoming: number }>();
  if (!itemNos.length) return out;
  const { data } = await supabase.from('inventory_cdv')
    .select('item_no, stock_bonded, incoming_stock').in('item_no', itemNos.slice(0, 500));
  for (const r of data || []) {
    out.set(String(r.item_no), { bonded: Math.max(0, Number(r.stock_bonded) || 0), incoming: Math.max(0, Number(r.incoming_stock) || 0) });
  }
  return out;
}

export async function createRestockAlert(input: {
  storeKey: string; itemNo: string; itemName: string; customerId: number; staff: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!STORES.some((s) => s.key === input.storeKey)) return { ok: false, error: '매장을 확인하세요.' };
  const { data: customer } = await supabase.from('sommelier_customers')
    .select('id').eq('id', input.customerId).maybeSingle();
  if (!customer) return { ok: false, error: '손님 정보를 찾을 수 없습니다.' };

  const baseline = (await hqAvailable([input.itemNo])).get(input.itemNo) ?? 0;
  const { error } = await supabase.from('store_restock_alerts').insert({
    corp: corpOfStore(input.storeKey), store_key: input.storeKey,
    item_no: input.itemNo, item_name: input.itemName.slice(0, 100),
    customer_id: input.customerId, staff: input.staff, baseline_hq: baseline,
  });
  if (error?.code === '23505') return { ok: true }; // 이미 대기 중 — 같은 결과
  if (error) throw error;
  return { ok: true };
}

/** 대기 중 알림의 입고 판정 — 본사 가용재고가 신청 시점보다 늘었으면 arrived. staff 지정 시 그 사원 것만. */
export async function checkArrivals(staff?: string): Promise<number> {
  let q = supabase.from('store_restock_alerts').select('id, item_no, baseline_hq').eq('status', 'waiting');
  if (staff) q = q.eq('staff', staff);
  const { data: waiting } = await q;
  if (!waiting?.length) return 0;
  const hq = await hqAvailable([...new Set(waiting.map((w) => String(w.item_no)))]);
  const arrived = waiting.filter((w) => (hq.get(String(w.item_no)) ?? 0) > Number(w.baseline_hq)).map((w) => w.id);
  if (arrived.length) {
    await supabase.from('store_restock_alerts')
      .update({ status: 'arrived', arrived_at: new Date().toISOString() }).in('id', arrived);
  }
  return arrived.length;
}

/** 내 알림 목록 — 조회 전에 입고 판정. 입고됨 → 대기 순, 완료는 최근 20건 */
export async function listMyAlerts(staff: string): Promise<RestockAlert[]> {
  await checkArrivals(staff);
  const cols = 'id, created_at, store_key, item_no, item_name, customer_id, status, arrived_at, done_at, customer:sommelier_customers(name, phone)';
  const [{ data: open }, { data: done }] = await Promise.all([
    supabase.from('store_restock_alerts').select(cols).eq('staff', staff).neq('status', 'done')
      .order('created_at', { ascending: false }),
    supabase.from('store_restock_alerts').select(cols).eq('staff', staff).eq('status', 'done')
      .order('done_at', { ascending: false }).limit(20),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = (r: any): RestockAlert => ({
    id: r.id, created_at: r.created_at, store_key: r.store_key, item_no: r.item_no, item_name: r.item_name,
    status: r.status, arrived_at: r.arrived_at, done_at: r.done_at,
    customer_id: r.customer_id, customer_name: r.customer?.name || '', customer_phone: r.customer?.phone || '',
    eta: null, bonded: 0, incoming_btls: 0,
  });
  // 입고 예정일 — 입항 일정(import_schedule). 입고 예정은 법인 무관 CDV 기준
  const openRows = open || [];
  const nos = [...new Set(openRows.map((r) => String(r.item_no)))];
  const [eta, pipe] = await Promise.all([loadArrivals('cdv', nos), hqPipeline(nos)]);
  const rows = openRows.map((r) => {
    const no = String(r.item_no);
    const arr = eta.get(no);
    const p = pipe.get(no);
    // 들어오는 병수 = 입항 일정 수량 우선, 없으면 재고표 미착 수량 (재고 행 '입고 N'과 같은 규칙)
    return { ...map(r), eta: arr?.date ?? null, bonded: p?.bonded ?? 0, incoming_btls: arr?.btls || p?.incoming || 0 };
  });
  return [...rows.filter((r) => r.status === 'arrived'), ...rows.filter((r) => r.status === 'waiting'), ...(done || []).map(map)];
}

/** 연락 완료(done) 또는 신청 취소(삭제) — 본인 신청 건만 */
export async function updateMyAlert(id: number, staff: string, action: 'done' | 'cancel'): Promise<void> {
  const base = supabase.from('store_restock_alerts');
  const { error } = action === 'done'
    ? await base.update({ status: 'done', done_at: new Date().toISOString() }).eq('id', id).eq('staff', staff)
    : await base.delete().eq('id', id).eq('staff', staff);
  if (error) throw error;
}

/** 크론 — 전체 입고 판정 후, 텔레그램 미발송 입고 건을 사원별로 묶어 발송(연동된 사원만). */
export async function notifyArrivals(): Promise<{ arrived: number; notified: number }> {
  const arrived = await checkArrivals();
  const { data: pending } = await supabase.from('store_restock_alerts')
    .select('id, staff, item_no, item_name, customer:sommelier_customers(name)')
    .eq('status', 'arrived').is('notified_at', null);
  if (!pending?.length) return { arrived, notified: 0 };

  const byStaff = new Map<string, typeof pending>();
  for (const p of pending) byStaff.set(p.staff, [...(byStaff.get(p.staff) || []), p]);
  const { data: users } = await supabase.from('sales_users')
    .select('manager, telegram_chat_id').in('manager', [...byStaff.keys()]).not('telegram_chat_id', 'is', null);
  const chat = new Map((users || []).map((u) => [u.manager, String(u.telegram_chat_id)]));

  let notified = 0;
  for (const [staff, rows] of byStaff) {
    const chatId = chat.get(staff);
    if (!chatId) continue; // 미연동 — 앱 안 알림으로만
    const html = [
      `<b>[입고 알림] ${rows.length}건</b>`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...rows.map((r) => `· ${escapeHtml((r.customer as any)?.name || '')} 님 — ${escapeHtml(r.item_name || r.item_no)}`),
      '매장 앱 메뉴 › 입고 알림에서 연락처를 확인하세요.',
    ].join('\n');
    const res = await sendTelegram(chatId, html);
    if (!res.ok) { logger.warn(`[restockAlerts] 텔레그램 실패 ${staff}: ${res.error}`); continue; }
    await supabase.from('store_restock_alerts').update({ notified_at: new Date().toISOString() }).in('id', rows.map((r) => r.id));
    notified += rows.length;
  }
  return { arrived, notified };
}
