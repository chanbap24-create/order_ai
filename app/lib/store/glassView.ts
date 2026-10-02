// 매장 앱 글라스 재고(서버 전용) — 와인 검색과 분리. 법인별 원장 그대로(CDV·DL 분리):
// · 까브드뱅 매장: inventory_cdv의 D 품번(리델 글라스) · 대유라이프 매장: inventory_dl의 D 품번(글라스·액세서리)
// 본사 = 리델 수입사인 대유라이프 재고표(inventory_dl)의 가용·보세·입고 — 두 재고표가 같은 품번(예: D797A11)을 쓰고
//   까브드뱅 표의 본사 칸은 0이라, 까브드뱅 매장 글라스도 본사 수치는 대유 표로 덮는다(와인의 overlayCdvHq와 대칭).
// 글라스는 와인 할인 밴드 대상 아님(정상가 그대로).
import { supabase } from '../db';
import { fetchAllRows } from '../fetchAll';
import { toJamo } from '../matcher-v3/jamo';
import { invCols, toRow } from './stockView';
import type { Corp, StoreKey, StoreStockRow } from './types';

const TABLE: Record<Corp, string> = { cdv: 'inventory_cdv', dl: 'inventory_dl' };
const NO_ARRIVALS = new Map<string, { date: string; btls: number }>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rowsOf = (corp: Corp, raw: any[]) => raw.map((r) => toRow(corp, r, null, NO_ARRIVALS));
const alive = (r: StoreStockRow) => r.store_total + r.hq_available + r.incoming > 0;

/** 까브드뱅 매장 글라스 행의 본사 수치를 대유 재고표로 교체 */
async function overlayDlHq(corp: Corp, rows: StoreStockRow[]): Promise<StoreStockRow[]> {
  if (corp === 'dl' || rows.length === 0) return rows;
  const out = new Map<string, { a: number; b: number; i: number }>();
  const nos = rows.map((r) => r.item_no);
  for (let i = 0; i < nos.length; i += 200) {
    const { data } = await supabase.from('inventory_dl')
      .select('item_no, available_stock, bonded_warehouse, incoming_stock').in('item_no', nos.slice(i, i + 200));
    for (const d of data || []) {
      out.set(String(d.item_no), {
        a: Math.max(0, Number(d.available_stock) || 0), b: Math.max(0, Number(d.bonded_warehouse) || 0), i: Math.max(0, Number(d.incoming_stock) || 0),
      });
    }
  }
  return rows.map((r) => {
    const d = out.get(r.item_no);
    return d ? { ...r, hq_available: d.a, hq_bonded: d.b, incoming: d.i } : r;
  });
}

export async function searchGlass(q: string, corp: Corp): Promise<StoreStockRow[]> {
  const query = q.trim();
  if (!query) return [];
  const tokens = query.split(/\s+/).filter((t) => t.length >= 1).map((t) => t.replace(/[,%()]/g, ''));
  // 이름 토큰 전부 포함(AND) — 'RD 0446' 같은 모델번호 검색이 정확하게
  let byName = supabase.from(TABLE[corp]).select(invCols(corp)).ilike('item_no', 'D%');
  for (const t of tokens) byName = byName.ilike('item_name', `%${t}%`);
  const [{ data: named }, jamo] = await Promise.all([
    byName.limit(80),
    // 대유 글라스는 자모 색인(glass_embeddings)도 — 오타·띄어쓰기 보정
    corp === 'dl' ? supabase.rpc('match_glasses_jamo', { q_jamo: toJamo(query), match_count: 30 }) : Promise.resolve({ data: [] }),
  ]);
  const extra = ((jamo.data || []) as Array<{ item_no: string; lex?: number }>)
    .filter((r) => (Number(r.lex) || 0) >= 0.4 && /^D/i.test(String(r.item_no)))
    .map((r) => String(r.item_no))
    .filter((no) => !(named || []).some((n: { item_no: string }) => n.item_no === no));
  const { data: more } = extra.length
    ? await supabase.from(TABLE[corp]).select(invCols(corp)).in('item_no', extra.slice(0, 30))
    : { data: [] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (await overlayDlHq(corp, rowsOf(corp, [...(named || []), ...(more || [])] as any[]))).filter(alive);
}

/** 매장 보유 글라스 — 그 매장 재고 > 0 */
export async function listGlass(storeKey: StoreKey, corp: Corp): Promise<StoreStockRow[]> {
  const raw = await fetchAllRows((f, t) =>
    supabase.from(TABLE[corp]).select(invCols(corp)).ilike('item_no', 'D%').gt(storeKey, 0).order('item_name').range(f, t));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return overlayDlHq(corp, rowsOf(corp, raw as any[]));
}
