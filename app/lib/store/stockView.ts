// 점장용 매장 재고 뷰 — "3초 재고 답변"의 데이터 레이어. 법인(까브/대유)별 소스 분리.
// CDV: inventory_cdv(매장 5 컬럼) + import_schedule(입항) + 소믈리에 할인 밴드.
// DL : inventory_dl(매장 2 컬럼). 입항 스케줄·할인 밴드는 와인 전용이라 미적용.
// 검색은 매처 v3와 같은 신호(자모 trgm RPC + 토큰)를 재사용하되 판정 LLM 없이 목록만.
import { supabase } from '../db';
import { toJamo } from '../matcher-v3/jamo';
import { loadDiscountBands, saleOf } from '../sommelierDiscount';
import { corpOfStore, storesOfCorp, type Corp, type StoreKey, type StoreStockRow } from './types';

export { STORES, corpOfStore, type Corp, type StoreKey, type StoreStockRow } from './types';

type Bands = Awaited<ReturnType<typeof loadDiscountBands>> | null;

/** 법인별 데이터 소스 (매처 v3 SRC 패턴) */
const SRC = {
  cdv: { table: 'inventory_cdv', jamoRpc: 'match_wines_jamo', embTable: 'wine_embeddings', embRpc: 'match_wines' },
  dl: { table: 'inventory_dl', jamoRpc: 'match_glasses_jamo', embTable: 'glass_embeddings', embRpc: 'match_glasses' },
} as const;

const invCols = (corp: Corp) => `item_no, item_name, vintage, retail_price, supply_price,
  available_stock, stock_bonded, incoming_stock,
  ${storesOfCorp(corp).map((s) => s.key).join(', ')}`
  // inventory_dl엔 생성 컬럼 stock_bonded가 없음 — 원시 bonded_warehouse 사용
  .replace('stock_bonded', corp === 'dl' ? 'bonded_warehouse' : 'stock_bonded');

const WINE_PREFIX = new Set(['0', '1', '2', '3', '4', '5', 'A']);
/** CDV는 와인 품번(ZK 제외)만 노출. DL은 전 품목. */
const keepItem = (corp: Corp, no: string) => corp === 'dl' || WINE_PREFIX.has(no.charAt(0).toUpperCase());

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRow(corp: Corp, r: any, bands: Bands, arrival: Map<string, { date: string; btls: number }>): StoreStockRow {
  const stores: Partial<Record<StoreKey, number>> = {};
  let storeTotal = 0;
  for (const s of storesOfCorp(corp)) {
    // ERP 조정으로 음수가 올 수 있음(반품 등) — 점장 화면엔 0 하한으로 표시
    const v = Math.max(0, Number(r[s.key]) || 0);
    stores[s.key] = v;
    storeTotal += v;
  }
  const retail = Number(r.retail_price) || 0;
  // 백화점 할인 밴드는 CDV 와인 전용 — DL은 정상가 그대로
  const { sale, rate } = bands ? saleOf(retail, bands) : { sale: retail, rate: 0 };
  const arr = arrival.get(String(r.item_no));
  return {
    item_no: String(r.item_no),
    item_name: String(r.item_name || ''),
    vintage: r.vintage ? String(r.vintage) : null,
    retail_price: retail,
    sale_price: sale,
    discount_rate: rate,
    hq_available: Math.max(0, Number(r.available_stock) || 0),
    hq_bonded: Math.max(0, Number(corp === 'dl' ? r.bonded_warehouse : r.stock_bonded) || 0),
    incoming: Math.max(0, Number(r.incoming_stock) || 0),
    arrival_date: arr?.date ?? null,
    arrival_btls: arr?.btls ?? 0,
    stores,
    store_total: storeTotal,
  };
}

const loadBands = (corp: Corp): Promise<Bands> => (corp === 'dl' ? Promise.resolve(null) : loadDiscountBands());

/** 미래·최근 입항 스케줄 (품목별 다음 입항) — CDV 와인 수입 전용 */
async function loadArrivals(corp: Corp, itemNos: string[]): Promise<Map<string, { date: string; btls: number }>> {
  const out = new Map<string, { date: string; btls: number }>();
  if (corp === 'dl' || itemNos.length === 0) return out;
  const cutoff = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  for (let i = 0; i < itemNos.length; i += 150) {
    const { data } = await supabase.from('import_schedule')
      .select('item_code, arrival_date, total_btls')
      .in('item_code', itemNos.slice(i, i + 150)).gte('arrival_date', cutoff);
    for (const r of data || []) {
      const code = String(r.item_code);
      const cur = out.get(code);
      if (!cur || String(r.arrival_date) < cur.date) {
        out.set(code, { date: String(r.arrival_date), btls: Number(r.total_btls) || 0 });
      }
    }
  }
  return out;
}

/** DL 매장 와인은 본사 물량이 inventory_cdv에 있다(법인 간 공유 재고) —
 *  같은 품번이 CDV 재고표에 있으면 본사 가용·보세·입고·입항을 CDV 값으로 교체.
 *  글라스(RD 등)는 CDV에 없으므로 inventory_dl 값 유지. */
async function overlayCdvHq(corp: Corp, rows: StoreStockRow[]): Promise<StoreStockRow[]> {
  if (corp !== 'dl' || rows.length === 0) return rows;
  const nos = rows.map((r) => r.item_no);
  const { data } = await supabase.from('inventory_cdv')
    .select('item_no, available_stock, stock_bonded, incoming_stock').in('item_no', nos);
  const cdv = new Map((data || []).map((r) => [String(r.item_no), r]));
  if (cdv.size === 0) return rows;
  const arrivals = await loadArrivals('cdv', [...cdv.keys()]);
  return rows.map((r) => {
    const c = cdv.get(r.item_no);
    if (!c) return r;
    const arr = arrivals.get(r.item_no);
    return {
      ...r,
      hq_available: Math.max(0, Number(c.available_stock) || 0),
      hq_bonded: Math.max(0, Number(c.stock_bonded) || 0),
      incoming: Math.max(0, Number(c.incoming_stock) || 0),
      arrival_date: arr?.date ?? null,
      arrival_btls: arr?.btls ?? 0,
    };
  });
}

/** 매장 재고 검색 — 자모 trgm(오타·브랜드) + 토큰 ILIKE 병합, 판매가능성과 무관하게 전 품목 */
export async function searchStoreStock(q: string, corp: Corp): Promise<StoreStockRow[]> {
  const query = q.trim();
  if (query.length < 1) return [];
  const src = SRC[corp];

  const tokens = query.split(/\s+/).filter((t) => t.length >= 2 && !/^\d+$/.test(t));
  const ors = tokens.map((t) => `item_name.ilike.%${t.replace(/[,%]/g, '')}%`);
  if (/^[0-9A-Za-z]{4,}$/.test(query)) ors.push(`item_no.ilike.${query}%`); // 품번 직접 검색

  const [jamoRes, tokenRes] = await Promise.all([
    supabase.rpc(src.jamoRpc, { q_jamo: toJamo(query), match_count: 24 }),
    ors.length
      ? supabase.from(src.table).select('item_no, item_name')
          .not('item_no', 'ilike', 'zk%').or(ors.join(',')).limit(400)
      : Promise.resolve({ data: [] as Array<{ item_no: string; item_name: string }> }),
  ]);

  // 점수 병합 (어휘 우선 — 매장 검색은 이름을 아는 사람이 찾는 용도)
  const qLower = query.toLowerCase();
  const score = new Map<string, number>();
  // 자모 임계값 — 짧은 쿼리(브랜드 코드)는 한 글자 겹침 잡음(0.333)이 많아 높게.
  // 예: 'cp' → CP 0.667 / CH·CD·CC 0.333 (긴 쿼리는 오타 허용 위해 낮게)
  const jamoMin = query.length <= 3 ? 0.5 : 0.3;
  for (const r of jamoRes.data || []) {
    const no = String(r.item_no);
    const lex = Number(r.lex) || 0;
    if (lex >= jamoMin && keepItem(corp, no)) score.set(no, Math.max(score.get(no) || 0, lex));
  }
  for (const r of tokenRes.data || []) {
    const no = String(r.item_no || '');
    if (!keepItem(corp, no)) continue;
    const name = String(r.item_name || '').toLowerCase();
    const hit = tokens.length ? tokens.filter((t) => name.includes(t.toLowerCase())).length / tokens.length : 0.5;
    // 브랜드 코드 검색('ch' 등) — 품명이 쿼리로 시작하면 최우선
    const prefix = name.startsWith(qLower) ? 0.3 : 0;
    score.set(no, Math.max(score.get(no) || 0, Math.min(1, 0.3 + 0.7 * hit + prefix)));
  }
  // 브랜드 코드처럼 짧은 쿼리는 품목이 많다 — 넉넉히 노출(스크롤 목록)
  const nos = [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([no]) => no);
  if (nos.length === 0) return [];

  const [{ data: inv }, bands] = await Promise.all([
    supabase.from(src.table).select(invCols(corp)).in('item_no', nos),
    loadBands(corp),
  ]);
  const arrivals = await loadArrivals(corp, nos);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await overlayCdvHq(corp, ((inv || []) as any[]).map((r) => toRow(corp, r, bands, arrivals)));
  // 정렬: 검색 점수 순 유지하되, 실판매품(판매가 있음)과 재고 보유를 더미·키트류보다 앞세운다
  const order = new Map(nos.map((no, i) => [no, i]));
  const demote = (r: StoreStockRow) =>
    (/더미|키트|쇼핑백|에어팩/.test(r.item_name) ? 2 : 0) + (r.retail_price <= 0 ? 1 : 0);
  return rows.sort((a, b) =>
    demote(a) - demote(b)
    || Number((b.store_total + b.hq_available) > 0) - Number((a.store_total + a.hq_available) > 0)
    || (order.get(a.item_no) ?? 99) - (order.get(b.item_no) ?? 99));
}

/** 홈 요약 — 우리 매장 품목수 · 들어오는 중 · 최근 입항 와인(CDV만) */
export async function storeSummary(storeKey: StoreKey): Promise<{
  my_items: number;
  incoming_items: number;
  recent_arrivals: Array<{ item_no: string; item_name: string; hq_available: number; arrival_date: string }>;
}> {
  const corp = corpOfStore(storeKey);
  const src = SRC[corp];
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  const [{ count: myItems }, { count: incomingItems }, { data: sched }] = await Promise.all([
    supabase.from(src.table).select('*', { count: 'exact', head: true }).gt(storeKey, 0),
    supabase.from(src.table).select('*', { count: 'exact', head: true }).gt('incoming_stock', 0),
    corp === 'cdv'
      ? supabase.from('import_schedule').select('item_code, item_name_kr, arrival_date')
          .gte('arrival_date', weekAgo).lte('arrival_date', today)
          .order('arrival_date', { ascending: false }).limit(30)
      : Promise.resolve({ data: [] as Array<{ item_code: string; item_name_kr: string; arrival_date: string }> }),
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

/** 대체품 — 저장된 임베딩으로 유사 품목 중 해당 매장/본사 재고 있는 것 (LLM 없음) */
export async function alternatives(itemNo: string, storeKey: StoreKey): Promise<StoreStockRow[]> {
  const corp = corpOfStore(storeKey);
  const src = SRC[corp];
  const { data: emb } = await supabase.from(src.embTable).select('embedding').eq('item_no', itemNo).maybeSingle();
  if (!emb?.embedding) return [];
  const { data: hits } = await supabase.rpc(src.embRpc, { query_embedding: emb.embedding, match_count: 12 });
  const nos = (hits || []).map((h: { item_no: string }) => String(h.item_no)).filter((no: string) => no !== itemNo);
  if (nos.length === 0) return [];
  const [{ data: inv }, bands] = await Promise.all([
    supabase.from(src.table).select(invCols(corp)).in('item_no', nos),
    loadBands(corp),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await overlayCdvHq(corp, ((inv || []) as any[]).map((r) => toRow(corp, r, bands, new Map())));
  return rows
    .filter((r) => ((r.stores[storeKey] || 0) > 0 || r.hq_available > 0)
      && r.retail_price > 0
      && !/더미|키트|쇼핑백|에어팩|세트/.test(r.item_name))
    .slice(0, 3);
}
