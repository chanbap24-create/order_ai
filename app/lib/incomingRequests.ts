// 입고 예정(입항·통관 전) 와인 대기 등록 — 거래처가 찾는 와인을 기록해뒀다가
// 통관 완료(가용재고 발생) 시 담당자에게 알림. CDV 와인 기준.
import { supabase } from './db';
import { fetchAllRows } from './fetchAll';

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

// 상태 판정 — '들어올 물량' 관점: 보세/입항 경과 → 통관 대기, 다음 물량 예정 → 입고 예정,
// 더 올 것 없이 가용만 남았으면 통관 완료. (가용이 있어도 예정이 남아 있으면 다음 물량 기준)
const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const statusOf = (
  r: { incoming: number; bonded: number; available: number },
  arrivalDate?: string | null,
): IncomingItem['status'] =>
  r.bonded > 0 || (!!arrivalDate && arrivalDate <= kstToday()) ? '통관 대기'
    : r.incoming > 0 ? '입고 예정'
      : r.available > 0 ? '통관 완료'
        : '입고 예정';

/** 입고 예정 품목 목록 — 재고표의 입고예정·보세 품목 + 수입 스케줄(최근 45일~미래 입항) + 대기 거래처.
 *  스케줄에는 있는데 재고표에 아직 수량이 안 잡힌 신규 입항 건도 포함(예: 입항 직후 반영 전). */
export async function listIncomingItems(manager: string, isAdmin: boolean): Promise<IncomingItem[]> {
  const cutoff = new Date(Date.now() - 45 * 86400_000).toISOString().slice(0, 10);
  const [{ data: inv }, { data: sched }, requests] = await Promise.all([
    supabase.from('inventory_cdv')
      .select('item_no, item_name, incoming_stock, stock_bonded, available_stock')
      .or('incoming_stock.gt.0,stock_bonded.gt.0'),
    supabase.from('import_schedule').select('item_code, item_name_kr, arrival_date, total_btls'),
    listRequests(manager, isAdmin),
  ]);
  // 품목당 스케줄이 여러 건(BL 여러 개)일 수 있음 — 마지막 행이 덮어쓰면 새로 올라온
  // 가까운 입항이 먼 미래 입항에 가려짐. 최근 45일~미래 중 가장 이른 날짜 우선, 전부 과거면 최신.
  const arrivalDates = new Map<string, string[]>();
  for (const s of sched || []) {
    if (!s.arrival_date) continue;
    (arrivalDates.get(s.item_code) ?? arrivalDates.set(s.item_code, []).get(s.item_code)!).push(s.arrival_date);
  }
  const arrival = new Map<string, string>();
  for (const [code, ds] of arrivalDates) {
    const upcoming = ds.filter((d) => d >= cutoff).sort();
    arrival.set(code, upcoming[0] ?? ds.sort()[ds.length - 1]);
  }
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
      bonded: Number(r.stock_bonded) || 0, // 보세 합계 = 생성 컬럼(단일 정의)
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
      .select('item_no, item_name, incoming_stock, stock_bonded, available_stock')
      .in('item_no', extraCodes.slice(i, i + 400));
    for (const w of ws || []) {
      extraInv.set(w.item_no, {
        item_name: w.item_name || '',
        incoming: Number(w.incoming_stock) || 0,
        bonded: Number(w.stock_bonded) || 0,
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

export type ArrivalRequest = IncomingRequest & { quoted_rate: number | null };
/** 같은 와인 이전 빈티지를 사갔던 거래처 (내 담당 · 최근 12개월 출고) */
export type PastBuyer = { client_code: string; client_name: string; qty: number; last_date: string; quoted_rate: number | null };
export type RecentArrival = Omit<ArrivalNotice, 'requests'> & {
  requests: ArrivalRequest[];
  past_buyers: PastBuyer[];
  notified_at: string | null;
  supply_price: number;
};

// 같은 와인 다른 빈티지 매칭용 베이스 (7자리 숫자 품번의 3~4자리=빈티지 제거)
const vintageBaseOf = (c: string) => (/^\d{7}$/.test(c) ? c.slice(0, 2) + c.slice(4) : c);

/** 최근 통관 완료 품목 — 브리핑 표시용.
 *  대상 = 최근 입항(45일) 스케줄 + 대기 등록 품목 중 가용재고가 생긴 것.
 *  그중 '내 접점'이 있는 품목만: 내 대기 등록이 있거나, 내 담당 거래처가 이전 빈티지를 사간 품목.
 *  (전부 띄우면 담당자와 무관한 품목까지 쌓여 노이즈 — 접점 필터로 개인화)
 *  quoted_rate = 그 거래처에 그 와인(다른 빈티지 포함)을 견적한 이력이 있으면 최근 견적의 할인률. */
export async function listRecentArrivals(manager: string, days = 14, arrivalWindowDays = 45): Promise<RecentArrival[]> {
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
  const todayKst = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const arrCutoff = new Date(Date.now() - arrivalWindowDays * 86400_000).toISOString().slice(0, 10);

  const [{ data: reqs }, { data: sched }] = await Promise.all([
    supabase.from('incoming_requests')
      .select('*').eq('manager', manager).in('status', ['waiting', 'notified']),
    // 최근 입항 스케줄 — 대기 등록이 없어도 통관 후보에 포함 (미래 입항은 아직 통관 전이므로 제외)
    supabase.from('import_schedule')
      .select('item_code, arrival_date').gte('arrival_date', arrCutoff).lte('arrival_date', todayKst),
  ]);
  const alive = ((reqs || []) as (IncomingRequest & { notified_at?: string | null })[])
    .filter((r) => r.status === 'waiting' || (r.notified_at && r.notified_at >= cutoff));
  const codes = [...new Set([
    ...alive.map((r) => r.item_code),
    ...(sched || []).map((s) => String(s.item_code)).filter(Boolean),
  ])];
  if (codes.length === 0) return [];

  // ── 이전 빈티지 구매 거래처 — 같은 베이스 품번(다른 빈티지)의 최근 12개월 출고, 내 담당 거래처만 ──
  // 담당 스코프 = client_details.manager (현재 담당 기준 — shipments.manager는 옛 담당이라 금지)
  // ⚠️ 이전 빈티지 품번은 재고표(inventory_cdv)에 없을 수 있다(품절 시 삭제 — 예: 3021851).
  //    반드시 출고 기록에서 LIKE 패턴으로 직접 찾는다.
  type ShipRow = { item_no: string; client_code: string; client_name: string | null; quantity: number; ship_date: string };
  const shipCutoff = new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10);
  const arrivalCodeSet = new Set(codes);
  const patterns = [...new Set(codes.filter((c) => /^\d{7}$/.test(c))
    .map((c) => `${c.slice(0, 2)}__${c.slice(4)}`))];
  const patternChunks: string[][] = [];
  for (let i = 0; i < patterns.length; i += 15) patternChunks.push(patterns.slice(i, i + 15));
  const [managerClientRows, shipArrays] = await Promise.all([
    fetchAllRows<{ client_code: string }>((f, t) => supabase.from('client_details')
      .select('client_code').eq('manager', manager).eq('client_type', 'wine').range(f, t)),
    Promise.all(patternChunks.map((chunk) =>
      fetchAllRows<ShipRow>((f, t) => supabase.from('shipments')
        .select('item_no, client_code, client_name, quantity, ship_date')
        .or(chunk.map((p) => `item_no.like.${p}`).join(','))
        .gte('ship_date', shipCutoff)
        .range(f, t)))),
  ]);
  const myClients = new Set(managerClientRows.map((r) => r.client_code));
  // base → 해당 베이스의 (거래처 → 수량/최근일)
  const buyersByBase = new Map<string, Map<string, { name: string; qty: number; last: string }>>();
  for (const s of shipArrays.flat()) {
    if (!s.client_code || !myClients.has(s.client_code)) continue;
    if (arrivalCodeSet.has(s.item_no)) continue; // 같은 빈티지(현 품번) 출고 제외 — '이전 빈티지'만
    const base = vintageBaseOf(s.item_no);
    const byClient = buyersByBase.get(base) ?? buyersByBase.set(base, new Map()).get(base)!;
    const cur = byClient.get(s.client_code) || { name: s.client_name || s.client_code, qty: 0, last: '' };
    cur.qty += Number(s.quantity) || 0;
    if (s.ship_date > cur.last) cur.last = s.ship_date;
    byClient.set(s.client_code, cur);
  }
  const pastBuyerCodes = [...new Set([...buyersByBase.values()].flatMap((m) => [...m.keys()]))];

  // 견적 이력 할인률 — 거래처별 최근 견적부터 훑어 (품번 정확 일치 우선, 없으면 같은 와인 다른 빈티지)
  const quoted = new Map<string, number>(); // `${client_code}|${code|base}` → rate(소수)
  const clientCodes = [...new Set([
    ...(alive.map((r) => r.client_code).filter(Boolean) as string[]),
    ...pastBuyerCodes,
  ])];
  if (clientCodes.length > 0) {
    const { data: qs } = await supabase.from('saved_quotes')
      .select('client_code, items, created_at')
      .in('client_code', clientCodes)
      .order('created_at', { ascending: false })
      .limit(300);
    for (const q of qs || []) {
      for (const it of ((q.items || []) as Array<{ item_code?: string; discount_rate?: number }>)) {
        const code = String(it.item_code || '');
        const rate = Number(it.discount_rate);
        if (!code || !Number.isFinite(rate) || rate <= 0) continue;
        for (const key of [`${q.client_code}|${code}`, `${q.client_code}|${vintageBaseOf(code)}`]) {
          if (!quoted.has(key)) quoted.set(key, rate); // created_at 내림차순 → 최근 견적 우선
        }
      }
    }
  }
  const quotedRateOf = (clientCode: string | null, itemCode: string): number | null =>
    clientCode
      ? quoted.get(`${clientCode}|${itemCode}`) ?? quoted.get(`${clientCode}|${vintageBaseOf(itemCode)}`) ?? null
      : null;
  const { data: inv } = await supabase.from('inventory_cdv')
    .select('item_no, item_name, available_stock, supply_price').in('item_no', codes).gt('available_stock', 0);
  const out: RecentArrival[] = [];
  for (const w of inv || []) {
    const rs = alive.filter((r) => r.item_code === w.item_no);
    const reqClientCodes = new Set(rs.map((r) => r.client_code).filter(Boolean));
    const pastBuyers: PastBuyer[] = [...(buyersByBase.get(vintageBaseOf(w.item_no)) || new Map()).entries()]
      .filter(([code]) => !reqClientCodes.has(code)) // 이미 대기 등록된 거래처는 제외
      .map(([code, b]) => ({
        client_code: code, client_name: b.name, qty: b.qty, last_date: b.last,
        quoted_rate: quotedRateOf(code, w.item_no),
      }))
      .sort((a, b) => b.last_date.localeCompare(a.last_date))
      .slice(0, 20);
    // 접점 필터 — 내 대기 등록도, 내 담당 거래처의 이전 빈티지 구매도 없으면 표시하지 않음
    if (rs.length === 0 && pastBuyers.length === 0) continue;
    out.push({
      item_code: w.item_no,
      item_name: w.item_name || '',
      available: Number(w.available_stock) || 0,
      supply_price: Number(w.supply_price) || 0,
      requests: rs.map((r) => ({ ...r, quoted_rate: quotedRateOf(r.client_code, w.item_no) })),
      past_buyers: pastBuyers,
      notified_at: rs.find((r) => r.status === 'notified')?.notified_at || null,
    });
  }
  // 대기 등록 품목 먼저 (미확인 우선 → 최근 확인 순), 그다음 접점만 있는 품목(이름순)
  return out.sort((a, b) => {
    const ar = a.requests.length > 0 ? 1 : 0, br = b.requests.length > 0 ? 1 : 0;
    if (ar !== br) return br - ar;
    if (ar === 1) return (b.notified_at || '9999').localeCompare(a.notified_at || '9999');
    return a.item_name.localeCompare(b.item_name, 'ko');
  });
}

/** 팝업 확인 처리 — 해당 품목의 내 대기 등록을 notified로 */
export async function ackArrivals(manager: string, itemCodes: string[]): Promise<void> {
  if (itemCodes.length === 0) return;
  const { error } = await supabase.from('incoming_requests')
    .update({ status: 'notified', notified_at: new Date().toISOString() })
    .eq('manager', manager).eq('status', 'waiting').in('item_code', itemCodes);
  if (error) throw error;
}
