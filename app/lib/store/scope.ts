// 매장 앱 보기 범위(서버 전용) — 누가 어느 매장 재고를 볼 수 있나를 세션이 정한다(요청 파라미터 무시).
// · 매장 직원(role='store'): 자기 매장 고정. 응답에서 다른 매장 수량을 제거해 화면·개발자도구 어디서도 안 보이게.
// · 본사(store_access): 'all' = 전체 매장. 까브·대유 두 법인 결과를 품번 기준으로 합친다(조회 전용, 판매 불가).
import type { SalesSession } from '../auth';
import { STORES, corpOfStore, isStoreKey, isWineItemNo, storesOfCorp, type Corp, type StoreStockRow, type StoreView } from './types';
import { listGlass, searchGlass } from './glassView';

/** 재고 종류 — 와인 / 글라스(리델 등). 화면 오른쪽 아래 버튼으로 전환 */
export type StockKind = 'wine' | 'glass';
// 와인 검색에서 글라스·액세서리 제외(대유 재고표는 와인·글라스가 한 표)
const winesOnly = (rows: StoreStockRow[]) => rows.filter((r) => isWineItemNo(r.item_no));
import { alternatives, listStoreStock, searchStoreStock, storeSummary } from './stockView';

export function storeViewOf(s: SalesSession | null): StoreView | null {
  if (!s?.store) return null;
  if (s.role === 'store') return isStoreKey(s.storeKey) ? s.storeKey : null; // 매장 미지정 계정은 차단
  return 'all';
}

/** 매장 직원 응답 — 다른 매장 수량 제거(합계도 그 매장 수량으로) */
const onlyStore = (rows: StoreStockRow[], key: string): StoreStockRow[] =>
  rows.map((r) => ({ ...r, stores: { [key]: r.stores[key] || 0 }, store_total: r.stores[key] || 0 }));

/** 두 법인 결과 합치기 — 같은 품번이면 매장별 수량을 합치고 합계 재계산(본사·입고는 앞쪽=CDV 기준) */
function mergeRows(...lists: StoreStockRow[][]): StoreStockRow[] {
  const out = new Map<string, StoreStockRow>();
  for (const r of lists.flat()) {
    const cur = out.get(r.item_no);
    if (!cur) { out.set(r.item_no, { ...r, stores: { ...r.stores } }); continue; }
    for (const [k, v] of Object.entries(r.stores)) cur.stores[k] = Math.max(cur.stores[k] || 0, v);
    cur.store_total = Object.values(cur.stores).reduce((a, b) => a + b, 0);
  }
  return [...out.values()];
}

export async function searchView(q: string, view: StoreView, kind: StockKind = 'wine') {
  if (kind === 'glass') {
    if (view !== 'all') return onlyStore(await searchGlass(q, corpOfStore(view)), view);
    return mergeRows(await searchGlass(q, 'cdv'), await searchGlass(q, 'dl'));
  }
  if (view !== 'all') return onlyStore(winesOnly(await searchStoreStock(q, corpOfStore(view))), view);
  return winesOnly(mergeRows(await searchStoreStock(q, 'cdv'), await searchStoreStock(q, 'dl')));
}

export async function listView(view: StoreView, mode: 'mine' | 'incoming', kind: StockKind = 'wine') {
  if (kind === 'glass') {
    if (view !== 'all') return onlyStore(await listGlass(view, corpOfStore(view)), view);
    const rows = mergeRows(...(await Promise.all(STORES.map((s) => listGlass(s.key, s.corp)))));
    return rows.sort((a, b) => a.item_name.localeCompare(b.item_name, 'ko'));
  }
  if (view !== 'all') return onlyStore(await listStoreStock(view, mode), view);
  if (mode === 'incoming') return listStoreStock(STORES[0].key, 'incoming'); // 입고는 법인 무관 CDV 기준
  const rows = mergeRows(...(await Promise.all(STORES.map((s) => listStoreStock(s.key, 'mine')))));
  return rows.sort((a, b) => a.item_name.localeCompare(b.item_name, 'ko'));
}

export async function summaryView(view: StoreView) {
  if (view !== 'all') return storeSummary(view);
  // 전체: 매장 보유 품목 = 어느 매장이든 있는 품목(중복 제거). 입고·최근 입항은 CDV 기준
  const [base, mine] = await Promise.all([storeSummary(STORES[0].key), listView('all', 'mine')]);
  return { ...base, my_items: mine.length };
}

export async function altView(itemNo: string, view: StoreView) {
  if (view !== 'all') return onlyStore(await alternatives(itemNo, view), view);
  const firstOf = (c: Corp) => storesOfCorp(c)[0].key;
  return mergeRows(await alternatives(itemNo, firstOf('cdv')), await alternatives(itemNo, firstOf('dl'))).slice(0, 3);
}
