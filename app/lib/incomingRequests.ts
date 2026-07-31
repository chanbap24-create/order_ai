// 입고 예정(입항·통관 전) 와인 대기 등록 — 거래처가 찾는 와인을 기록해뒀다가
// 통관 완료(가용재고 발생) 시 담당자에게 알림. CDV 와인 기준.
import { supabase } from './db';

export type IncomingItem = {
  item_code: string;
  item_name: string;
  status: '입고 예정' | '통관 대기' | '통관 완료';
  incoming: number;        // 입고 예정 수량(재고표)
  bonded: number;          // 보세창고(입항, 통관 전)
  available: number;       // 가용재고(통관 완료)
  arrival_date: string | null; // 입항 예정일(수입 스케줄)
  requests: IncomingRequest[];
};

export type IncomingRequest = {
  id: number;
  item_code: string;
  item_name: string | null;
  client_code: string | null;
  client_name: string;
  manager: string;
  memo: string | null;
  status: string;
  created_at: string;
};

const statusOf = (r: { incoming: number; bonded: number; available: number }): IncomingItem['status'] =>
  r.available > 0 ? '통관 완료' : r.bonded > 0 ? '통관 대기' : '입고 예정';

/** 입고 예정 품목 목록 — 재고표의 입고예정·보세 품목 + 수입 스케줄 입항일 + 대기 거래처 */
export async function listIncomingItems(manager: string, isAdmin: boolean): Promise<IncomingItem[]> {
  const [{ data: inv }, { data: sched }, requests] = await Promise.all([
    supabase.from('inventory_cdv')
      .select('item_no, item_name, incoming_stock, bonded_warehouse, available_stock')
      .or('incoming_stock.gt.0,bonded_warehouse.gt.0'),
    supabase.from('import_schedule').select('item_code, arrival_date'),
    listRequests(manager, isAdmin),
  ]);
  const arrival = new Map<string, string>();
  for (const s of sched || []) if (s.arrival_date) arrival.set(s.item_code, s.arrival_date);
  const reqByItem = new Map<string, IncomingRequest[]>();
  for (const r of requests) {
    (reqByItem.get(r.item_code) ?? reqByItem.set(r.item_code, []).get(r.item_code)!).push(r);
  }

  const items = new Map<string, IncomingItem>();
  for (const r of inv || []) {
    const row = {
      incoming: Number(r.incoming_stock) || 0,
      bonded: Number(r.bonded_warehouse) || 0,
      available: Number(r.available_stock) || 0,
    };
    items.set(r.item_no, {
      item_code: r.item_no,
      item_name: r.item_name || '',
      status: statusOf(row),
      ...row,
      arrival_date: arrival.get(r.item_no) || null,
      requests: reqByItem.get(r.item_no) || [],
    });
  }
  // 대기 등록이 있는데 재고표에서 빠진 품목도 표시(재고 상태 미확인이어도 등록은 보이게)
  for (const [code, reqs] of reqByItem) {
    if (items.has(code)) continue;
    const { data: w } = await supabase.from('inventory_cdv')
      .select('item_name, incoming_stock, bonded_warehouse, available_stock').eq('item_no', code).maybeSingle();
    const row = {
      incoming: Number(w?.incoming_stock) || 0,
      bonded: Number(w?.bonded_warehouse) || 0,
      available: Number(w?.available_stock) || 0,
    };
    items.set(code, {
      item_code: code,
      item_name: w?.item_name || reqs[0]?.item_name || '',
      status: statusOf(row),
      ...row,
      arrival_date: arrival.get(code) || null,
      requests: reqs,
    });
  }
  return [...items.values()].sort((a, b) =>
    (a.arrival_date || '9999').localeCompare(b.arrival_date || '9999') || a.item_name.localeCompare(b.item_name, 'ko'));
}

export async function listRequests(manager: string, isAdmin: boolean): Promise<IncomingRequest[]> {
  let q = supabase.from('incoming_requests').select('*').eq('status', 'waiting').order('created_at');
  if (!isAdmin) q = q.eq('manager', manager);
  const { data } = await q;
  return (data || []) as IncomingRequest[];
}

export async function addRequest(p: {
  itemCode: string; itemName: string; clientCode: string | null; clientName: string; manager: string; memo?: string;
}): Promise<IncomingRequest> {
  const { data, error } = await supabase.from('incoming_requests').insert({
    item_code: p.itemCode, item_name: p.itemName,
    client_code: p.clientCode, client_name: p.clientName,
    manager: p.manager, memo: p.memo || null,
  }).select('*').single();
  if (error) throw error;
  return data as IncomingRequest;
}

export async function removeRequest(id: number, manager: string, isAdmin: boolean): Promise<void> {
  let q = supabase.from('incoming_requests').delete().eq('id', id);
  if (!isAdmin) q = q.eq('manager', manager);
  const { error } = await q;
  if (error) throw error;
}

export type ArrivalNotice = { item_code: string; item_name: string; available: number; requests: IncomingRequest[] };

/** 통관 완료(가용재고 발생)된 대기 품목 — 세일즈 접속 시 팝업용 */
export async function checkArrivals(manager: string): Promise<ArrivalNotice[]> {
  const { data: reqs } = await supabase.from('incoming_requests')
    .select('*').eq('status', 'waiting').eq('manager', manager);
  if (!reqs || reqs.length === 0) return [];
  const codes = [...new Set(reqs.map((r) => r.item_code))];
  const { data: inv } = await supabase.from('inventory_cdv')
    .select('item_no, item_name, available_stock').in('item_no', codes).gt('available_stock', 0);
  const notices: ArrivalNotice[] = [];
  for (const w of inv || []) {
    notices.push({
      item_code: w.item_no,
      item_name: w.item_name || '',
      available: Number(w.available_stock) || 0,
      requests: (reqs as IncomingRequest[]).filter((r) => r.item_code === w.item_no),
    });
  }
  return notices;
}

/** 팝업 확인 처리 — 해당 품목의 내 대기 등록을 notified로 */
export async function ackArrivals(manager: string, itemCodes: string[]): Promise<void> {
  if (itemCodes.length === 0) return;
  const { error } = await supabase.from('incoming_requests')
    .update({ status: 'notified', notified_at: new Date().toISOString() })
    .eq('manager', manager).eq('status', 'waiting').in('item_code', itemCodes);
  if (error) throw error;
}
