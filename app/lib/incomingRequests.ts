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
  registered_by?: string | null;
  status: string;
  created_at: string;
};

// 상태 판정 — 재고표 수량 우선, 수량이 아직 안 잡혔어도 입항일이 지났으면 보세(통관 대기)로 추정
const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const statusOf = (
  r: { incoming: number; bonded: number; available: number },
  arrivalDate?: string | null,
): IncomingItem['status'] =>
  r.available > 0 ? '통관 완료'
    : r.bonded > 0 || (!!arrivalDate && arrivalDate <= kstToday()) ? '통관 대기'
      : '입고 예정';

/** 입고 예정 품목 목록 — 재고표의 입고예정·보세 품목 + 수입 스케줄(최근 45일~미래 입항) + 대기 거래처.
 *  스케줄에는 있는데 재고표에 아직 수량이 안 잡힌 신규 입항 건도 포함(예: 입항 직후 반영 전). */
export async function listIncomingItems(manager: string, isAdmin: boolean): Promise<IncomingItem[]> {
  const cutoff = new Date(Date.now() - 45 * 86400_000).toISOString().slice(0, 10);
  const [{ data: inv }, { data: sched }, requests] = await Promise.all([
    supabase.from('inventory_cdv')
      .select('item_no, item_name, incoming_stock, bonded_warehouse, available_stock')
      .or('incoming_stock.gt.0,bonded_warehouse.gt.0'),
    supabase.from('import_schedule').select('item_code, item_name_kr, arrival_date, total_btls'),
    listRequests(manager, isAdmin),
  ]);
  const arrival = new Map<string, string>();
  for (const s of sched || []) if (s.arrival_date) arrival.set(s.item_code, s.arrival_date);
  // 지난 입항이 이미 소화된 품목(가용 있음·보세 없음·입항 45일 경과)의 낡은 날짜는
  // 다음 발주 물량과 무관하므로 표시하지 않음 — 새 BL이 스케줄에 오르면 갱신됨
  const staleDate = (code: string, row: { bonded: number; available: number }) => {
    const d = arrival.get(code);
    return d && d < cutoff && row.bonded === 0 && row.available > 0 ? null : d || null;
  };
  // 최근·예정 입항 스케줄 (품목별 병수 합산)
  const recentSched = new Map<string, { name: string; btls: number }>();
  for (const s of sched || []) {
    if (!s.arrival_date || s.arrival_date < cutoff) continue;
    const cur = recentSched.get(s.item_code);
    recentSched.set(s.item_code, {
      name: cur?.name || s.item_name_kr || '',
      btls: (cur?.btls || 0) + (Number(s.total_btls) || 0),
    });
  }
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
      status: statusOf(row, staleDate(r.item_no, row)),
      ...row,
      arrival_date: staleDate(r.item_no, row),
      requests: reqByItem.get(r.item_no) || [],
    });
  }
  // 스케줄의 최근·예정 입항 + 대기 등록 품목 중 재고표 파이프라인에 없는 것 — 일괄 보충
  const extraCodes = [
    ...[...recentSched.keys()].filter((c) => !items.has(c)),
    ...[...reqByItem.keys()].filter((c) => !items.has(c) && !recentSched.has(c)),
  ];
  const extraInv = new Map<string, { item_name: string; incoming: number; bonded: number; available: number }>();
  for (let i = 0; i < extraCodes.length; i += 400) {
    const { data: ws } = await supabase.from('inventory_cdv')
      .select('item_no, item_name, incoming_stock, bonded_warehouse, available_stock')
      .in('item_no', extraCodes.slice(i, i + 400));
    for (const w of ws || []) {
      extraInv.set(w.item_no, {
        item_name: w.item_name || '',
        incoming: Number(w.incoming_stock) || 0,
        bonded: Number(w.bonded_warehouse) || 0,
        available: Number(w.available_stock) || 0,
      });
    }
  }
  for (const code of extraCodes) {
    const w = extraInv.get(code);
    const schedInfo = recentSched.get(code);
    const row = {
      incoming: w?.incoming || (w?.available ? 0 : schedInfo?.btls || 0), // 재고표 미반영이면 스케줄 병수
      bonded: w?.bonded || 0,
      available: w?.available || 0,
    };
    items.set(code, {
      item_code: code,
      item_name: w?.item_name || schedInfo?.name || reqByItem.get(code)?.[0]?.item_name || '',
      status: statusOf(row, staleDate(code, row)),
      ...row,
      arrival_date: staleDate(code, row),
      requests: reqByItem.get(code) || [],
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
  // 알림 대상 = 등록한 영업사원 본인
  const { data, error } = await supabase.from('incoming_requests').insert({
    item_code: p.itemCode, item_name: p.itemName,
    client_code: p.clientCode, client_name: p.clientName,
    manager: p.manager, registered_by: p.manager, memo: p.memo || null,
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
