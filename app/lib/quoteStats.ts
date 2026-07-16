// 견적 발행 → 발주(전환) 시계열 집계 — saved_quotes × shipments 실시간 계산.
// 발주 판정 = 견적 품목이 견적일~+60일 내 그 거래처로 유상 출고(quoteConversion과 동일 기준).
import { supabase } from './db';
import { isPromoClient } from './quoteConversion';

const WINDOW_DAYS = 60;

export interface QuoteStatsBucket {
  key: string;    // 'YYYY-MM' | 주 시작일 'YYYY-MM-DD'
  label: string;  // '7월' | '7/14~'
  quotes: number; // 견적 건수
  clients: number; // 발행 거래처 수(고유)
  ordered: number; // 발주 거래처 수(견적 품목이 60일 내 출고)
  rate: number;   // 발주율 % (ordered/clients)
}

function addDays(d: string, n: number): string {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
/** 주 시작(월요일) 날짜 */
function mondayOf(d: string): string {
  const t = new Date(`${d}T00:00:00Z`);
  const w = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - w);
  return t.toISOString().slice(0, 10);
}

export async function getQuoteStats(opts: {
  type: 'wine' | 'glass';
  manager?: string;   // ''=전체(어드민)
  months: number;
  bucket: 'week' | 'month';
}): Promise<{ buckets: QuoteStatsBucket[]; windowDays: number }> {
  const sinceD = new Date(Date.now() + 9 * 3600 * 1000);
  sinceD.setUTCMonth(sinceD.getUTCMonth() - opts.months);
  const since = sinceD.toISOString().slice(0, 10);

  let q = supabase
    .from('saved_quotes')
    .select('id, client_code, company, created_at, items')
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(3000);
  if (opts.manager) q = q.eq('manager', opts.manager);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const wantDL = opts.type === 'glass';
  const rows = (data || [])
    .filter((r) => (r.company === 'DL') === wantDL && r.client_code && !isPromoClient(r.client_code))
    .map((r) => ({
      client: String(r.client_code),
      date: String(r.created_at).slice(0, 10),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      codes: [...new Set(((Array.isArray(r.items) ? r.items : []) as any[])
        .map((it) => String(it.item_code || '')).filter(Boolean))],
    }));
  if (rows.length === 0) return { buckets: [], windowDays: WINDOW_DAYS };

  // 출고 벌크 로드(전환 판정용): 견적 거래처 × [since, 오늘], 유상만. 1000행 캡 → 페이지네이션.
  const shipTable = wantDL ? 'glass_shipments' : 'shipments';
  const clients = [...new Set(rows.map((r) => r.client))];
  const ships = new Map<string, { item: string; date: string }[]>();
  for (let i = 0; i < clients.length; i += 100) {
    const chunk = clients.slice(i, i + 100);
    for (let off = 0; off < 100000; off += 1000) {
      const { data: sd, error: se } = await supabase
        .from(shipTable)
        .select('client_code, item_no, ship_date')
        .in('client_code', chunk)
        .gte('ship_date', since)
        .gt('selling_price', 0)
        .range(off, off + 999);
      if (se) throw new Error(se.message);
      if (!sd || sd.length === 0) break;
      for (const s of sd) {
        const arr = ships.get(s.client_code) || [];
        arr.push({ item: String(s.item_no), date: String(s.ship_date).slice(0, 10) });
        ships.set(s.client_code, arr);
      }
      if (sd.length < 1000) break;
    }
  }

  // 견적일 기준 버킷 집계
  const map = new Map<string, { quotes: number; clients: Set<string>; ordered: Set<string> }>();
  for (const r of rows) {
    const key = opts.bucket === 'month' ? r.date.slice(0, 7) : mondayOf(r.date);
    const b = map.get(key) || { quotes: 0, clients: new Set<string>(), ordered: new Set<string>() };
    b.quotes += 1;
    b.clients.add(r.client);
    const end = addDays(r.date, WINDOW_DAYS);
    const codeSet = new Set(r.codes);
    const converted = (ships.get(r.client) || [])
      .some((s) => codeSet.has(s.item) && s.date >= r.date && s.date <= end);
    if (converted) b.ordered.add(r.client);
    map.set(key, b);
  }

  const buckets: QuoteStatsBucket[] = [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, b]) => ({
      key,
      label: opts.bucket === 'month'
        ? `${Number(key.slice(5, 7))}월`
        : `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}~`,
      quotes: b.quotes,
      clients: b.clients.size,
      ordered: b.ordered.size,
      rate: b.clients.size ? Math.round((b.ordered.size / b.clients.size) * 1000) / 10 : 0,
    }));
  return { buckets, windowDays: WINDOW_DAYS };
}
