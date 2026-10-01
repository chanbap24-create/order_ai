// 점장용 매장 재고 뷰 — "3초 재고 답변"의 데이터 레이어.
// 소스: inventory_cdv(매일 갱신 — 매장 컬럼·가용·보세·미착) + import_schedule(입항) + 소믈리에 할인 밴드.
// 검색은 매처 v3와 같은 신호(자모 trgm RPC + 토큰)를 재사용하되 판정 LLM 없이 목록만.
import { supabase } from '../db';
import { toJamo } from '../matcher-v3/jamo';
import { loadDiscountBands, saleOf } from '../sommelierDiscount';
import { STORES, type StoreKey, type StoreStockRow } from './types';

export { STORES, type StoreKey, type StoreStockRow } from './types';

const INV_COLS = `item_no, item_name, vintage, retail_price, supply_price,
  available_stock, stock_bonded, incoming_stock,
  ${STORES.map((s) => s.key).join(', ')}`;

const WINE_PREFIX = new Set(['0', '1', '2', '3', '4', '5', 'A']);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRow(r: any, bands: Awaited<ReturnType<typeof loadDiscountBands>>, arrival: Map<string, { date: string; btls: number }>): StoreStockRow {
  const stores = {} as Record<StoreKey, number>;
  let storeTotal = 0;
  for (const s of STORES) {
    // ERP 조정으로 음수가 올 수 있음(반품 등) — 점장 화면엔 0 하한으로 표시
    const v = Math.max(0, Number(r[s.key]) || 0);
    stores[s.key] = v;
    storeTotal += v;
  }
  const retail = Number(r.retail_price) || 0;
  const { sale, rate } = saleOf(retail, bands);
  const arr = arrival.get(String(r.item_no));
  return {
    item_no: String(r.item_no),
    item_name: String(r.item_name || ''),
    vintage: r.vintage ? String(r.vintage) : null,
    retail_price: retail,
    sale_price: sale,
    discount_rate: rate,
    hq_available: Number(r.available_stock) || 0,
    hq_bonded: Number(r.stock_bonded) || 0,
    incoming: Number(r.incoming_stock) || 0,
    arrival_date: arr?.date ?? null,
    arrival_btls: arr?.btls ?? 0,
    stores,
    store_total: storeTotal,
  };
}

/** 미래·최근 입항 스케줄 (품목별 다음 입항) */
async function loadArrivals(itemNos: string[]): Promise<Map<string, { date: string; btls: number }>> {
  const out = new Map<string, { date: string; btls: number }>();
  if (itemNos.length === 0) return out;
  const cutoff = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  for (let i = 0; i < itemNos.length; i += 150) {
    const { data } = await supabase.from('import_schedule')
      .select('item_code, arrival_date, total_btls')
      .in('item_code', itemNos.slice(i, i + 150)).gte('arrival_date', cutoff);
    for (const r of data || []) {
      const code = String(r.item_code);
      const cur = out.get(code);
      // 가장 가까운 입항 우선
      if (!cur || String(r.arrival_date) < cur.date) {
        out.set(code, { date: String(r.arrival_date), btls: Number(r.total_btls) || 0 });
      }
    }
  }
  return out;
}

/** 매장 재고 검색 — 자모 trgm(오타·브랜드) + 토큰 ILIKE 병합, 판매가능성과 무관하게 전 품목 */
export async function searchStoreStock(q: string): Promise<StoreStockRow[]> {
  const query = q.trim();
  if (query.length < 1) return [];

  const tokens = query.split(/\s+/).filter((t) => t.length >= 2 && !/^\d+$/.test(t));
  const ors = tokens.map((t) => `item_name.ilike.%${t.replace(/[,%]/g, '')}%`);
  if (/^[0-9A-Za-z]{4,}$/.test(query)) ors.push(`item_no.ilike.${query}%`); // 품번 직접 검색

  const [jamoRes, tokenRes] = await Promise.all([
    supabase.rpc('match_wines_jamo', { q_jamo: toJamo(query), match_count: 12 }),
    ors.length
      ? supabase.from('inventory_cdv').select('item_no, item_name')
          .not('item_no', 'ilike', 'zk%').or(ors.join(',')).limit(150)
      : Promise.resolve({ data: [] as Array<{ item_no: string; item_name: string }> }),
  ]);

  // 점수 병합 (어휘 우선 — 매장 검색은 이름을 아는 사람이 찾는 용도)
  const score = new Map<string, number>();
  for (const r of jamoRes.data || []) {
    const no = String(r.item_no);
    if (WINE_PREFIX.has(no.charAt(0).toUpperCase())) score.set(no, Math.max(score.get(no) || 0, Number(r.lex) || 0));
  }
  for (const r of tokenRes.data || []) {
    const no = String(r.item_no || '');
    if (!WINE_PREFIX.has(no.charAt(0).toUpperCase())) continue;
    const name = String(r.item_name || '');
    const hit = tokens.length ? tokens.filter((t) => name.includes(t)).length / tokens.length : 0.5;
    score.set(no, Math.max(score.get(no) || 0, 0.3 + 0.7 * hit));
  }
  const nos = [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([no]) => no);
  if (nos.length === 0) return [];

  const [{ data: inv }, bands] = await Promise.all([
    supabase.from('inventory_cdv').select(INV_COLS).in('item_no', nos),
    loadDiscountBands(),
  ]);
  const arrivals = await loadArrivals(nos);
  const rows = (inv || []).map((r) => toRow(r, bands, arrivals));
  // 정렬: 검색 점수 순 유지하되, 실판매품(판매가 있음)과 재고 보유를 더미·키트류보다 앞세운다
  const order = new Map(nos.map((no, i) => [no, i]));
  const demote = (r: StoreStockRow) =>
    (/더미|키트|쇼핑백|에어팩/.test(r.item_name) ? 2 : 0) + (r.retail_price <= 0 ? 1 : 0);
  return rows.sort((a, b) =>
    demote(a) - demote(b)
    || Number((b.store_total + b.hq_available) > 0) - Number((a.store_total + a.hq_available) > 0)
    || (order.get(a.item_no) ?? 99) - (order.get(b.item_no) ?? 99));
}

/** 홈 요약 — 우리 매장 품목수 · 들어오는 중 · 최근 입항 와인 */
export async function storeSummary(storeKey: StoreKey): Promise<{
  my_items: number;
  incoming_items: number;
  recent_arrivals: Array<{ item_no: string; item_name: string; hq_available: number; arrival_date: string }>;
}> {
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  const [{ count: myItems }, { count: incomingItems }, { data: sched }] = await Promise.all([
    supabase.from('inventory_cdv').select('*', { count: 'exact', head: true }).gt(storeKey, 0),
    supabase.from('inventory_cdv').select('*', { count: 'exact', head: true }).gt('incoming_stock', 0),
    supabase.from('import_schedule').select('item_code, item_name_kr, arrival_date')
      .gte('arrival_date', weekAgo).lte('arrival_date', today)
      .order('arrival_date', { ascending: false }).limit(30),
  ]);
  // 최근 입항 품목의 본사 가용 (통관 완료된 것 위주 노출)
  const codes = [...new Set((sched || []).map((s) => String(s.item_code)))].slice(0, 30);
  const availMap = new Map<string, { name: string; avail: number }>();
  if (codes.length) {
    const { data } = await supabase.from('inventory_cdv')
      .select('item_no, item_name, available_stock').in('item_no', codes);
    for (const r of data || []) availMap.set(String(r.item_no), { name: String(r.item_name || ''), avail: Number(r.available_stock) || 0 });
  }
  const seen = new Set<string>();
  const recent: Array<{ item_no: string; item_name: string; hq_available: number; arrival_date: string }> = [];
  for (const s of sched || []) {
    const code = String(s.item_code);
    if (seen.has(code)) continue;
    seen.add(code);
    const m = availMap.get(code);
    if (!m || m.avail <= 0) continue; // 통관 전(가용 0)은 제외
    recent.push({ item_no: code, item_name: m.name || String(s.item_name_kr || ''), hq_available: m.avail, arrival_date: String(s.arrival_date) });
    if (recent.length >= 5) break;
  }
  return { my_items: myItems || 0, incoming_items: incomingItems || 0, recent_arrivals: recent };
}

/** 대체품 — 저장된 임베딩으로 유사 와인 중 해당 매장/본사 재고 있는 것 (LLM 없음) */
export async function alternatives(itemNo: string, storeKey: StoreKey): Promise<StoreStockRow[]> {
  const { data: emb } = await supabase.from('wine_embeddings').select('embedding').eq('item_no', itemNo).maybeSingle();
  if (!emb?.embedding) return [];
  const { data: hits } = await supabase.rpc('match_wines', { query_embedding: emb.embedding, match_count: 12 });
  const nos = (hits || []).map((h: { item_no: string }) => String(h.item_no)).filter((no: string) => no !== itemNo);
  if (nos.length === 0) return [];
  const [{ data: inv }, bands] = await Promise.all([
    supabase.from('inventory_cdv').select(INV_COLS).in('item_no', nos),
    loadDiscountBands(),
  ]);
  const rows = (inv || []).map((r) => toRow(r, bands, new Map()));
  return rows
    .filter((r) => (r.stores[storeKey] > 0 || r.hq_available > 0)
      && r.retail_price > 0
      && !/더미|키트|쇼핑백|에어팩|세트/.test(r.item_name))
    .slice(0, 3);
}
