// 시음주 원장(현황/결재 공용): 실제 출고내역에서 시음주를 뽑고 발주전환·상신여부를 붙인다.
// 시음주 = 무상(selling_price=0) + 1병(quantity=1) + 와인(부자재 제외). order-v2 등록분도 결국 이 출고로 잡힘.
import { supabase } from "@/app/lib/db";

export type Company = "CDV" | "DL";

export interface TastingLedgerRow {
  key: string;          // 자연키: ship_date|client_code|item_no
  ship_date: string;    // YYYY-MM-DD
  client_code: string;
  client_name: string;
  item_no: string;
  item_name: string;
  supply: number;       // 공급가(unit_price)
  manager: string;
  converted: boolean;   // 이후 같은 거래처가 그 와인을 유상 구매(발주 전환)했는지
  submitted: boolean;   // 결재 상신 완료 여부
  quoteIds: number[];   // 이 행을 만든 saved_quotes id (등록분). 실제 출고분은 빈 배열 → 삭제 불가.
}

// 부자재(쇼핑백·지함·박스 등) — 시음주에서 제외.
const MATERIAL_KW = ["쇼핑백", "지함", "칠러", "박스", "캐리어", "봉투", "스티커", "리플렛", "포장", "완충", "아이스팩", "행택", "카톤"];
const isMaterial = (name: string) => MATERIAL_KW.some((k) => (name || "").includes(k));
const ymd = (s: string) => (s || "").slice(0, 10);
const mkKey = (r: { ship_date: string; client_code: string; item_no: string }) =>
  `${ymd(r.ship_date)}|${r.client_code || ""}|${r.item_no || ""}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export interface LedgerQuery {
  company: Company;
  managers?: string[] | null; // null/빈 = 전체
  start: string;
  end: string;
}

interface Cand {
  ship_date: string; client_code: string; client_name: string;
  item_no: string; item_name: string; supply: number; manager: string;
  quoteSubmitted: boolean; // saved_quotes.tasting_submitted_at 기반
  quoteIds: number[];      // saved_quotes id (출고분은 빈 배열)
}

export async function getTastingLedger(opts: LedgerQuery): Promise<TastingLedgerRow[]> {
  const { company, managers, start, end } = opts;
  const shipTable = company === "DL" ? "glass_shipments" : "shipments";
  const cands: Cand[] = [];

  // A) 실제 출고 시음주: 무상 + 1병 + 와인(부자재 제외)
  let q = supabase.from(shipTable)
    .select("ship_date, client_code, client_name, item_no, item_name, unit_price, quantity, selling_price, manager")
    .gte("ship_date", start).lte("ship_date", end)
    .eq("selling_price", 0).eq("quantity", 1)
    .limit(8000);
  if (managers && managers.length) q = q.in("manager", managers);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  let ship = (data || []).filter((r: Row) => !isMaterial(r.item_name));
  if (company === "CDV") {
    const itemNos = [...new Set(ship.map((r: Row) => r.item_no).filter(Boolean))];
    const wineSet = new Set<string>();
    for (let i = 0; i < itemNos.length; i += 500) {
      const { data: ws } = await supabase.from("wines")
        .select("item_code, wine_type").in("item_code", itemNos.slice(i, i + 500));
      (ws || []).forEach((w: Row) => { if (String(w.wine_type || "").trim()) wineSet.add(w.item_code); });
    }
    ship = ship.filter((r: Row) => wineSet.has(r.item_no));
  }
  for (const r of ship as Row[]) cands.push({
    ship_date: ymd(r.ship_date), client_code: r.client_code || "", client_name: r.client_name || "",
    item_no: r.item_no || "", item_name: r.item_name || "", supply: Number(r.unit_price) || 0,
    manager: r.manager || "", quoteSubmitted: false, quoteIds: [],
  });

  // B) order-v2 등록분: saved_quotes(is_tasting) — 아직 출고 안 된 것도 포함(출고일 또는 등록일이 기간 내)
  let sq = supabase.from("saved_quotes")
    .select("id, client_code, client_name, manager, items, created_at, doc_settings, tasting_submitted_at")
    .eq("is_tasting", true).eq("company", company);
  if (managers && managers.length) sq = sq.in("manager", managers);
  const { data: sqData } = await sq;
  for (const r of (sqData || []) as Row[]) {
    const it = Array.isArray(r.items) ? r.items[0] : null;
    if (!it) continue;
    const ds = r.doc_settings && typeof r.doc_settings === "object" ? r.doc_settings : {};
    const shipD = /^\d{4}-\d{2}-\d{2}/.test(String(ds.ship_date || "")) ? String(ds.ship_date).slice(0, 10) : ymd(r.created_at);
    const createdD = ymd(r.created_at);
    if (!((shipD >= start && shipD <= end) || (createdD >= start && createdD <= end))) continue;
    cands.push({
      ship_date: shipD, client_code: r.client_code || "", client_name: r.client_name || "",
      item_no: String(it.item_code || ""), item_name: String(it.product_name || ""), supply: Number(it.supply_price) || 0,
      manager: r.manager || "", quoteSubmitted: !!r.tasting_submitted_at,
      quoteIds: r.id != null ? [Number(r.id)] : [],
    });
  }
  if (!cands.length) return [];

  // 자연키 중복 제거(출고 우선, 상신플래그는 OR로 보존)
  const byKey = new Map<string, Cand>();
  for (const c of cands) {
    const k = mkKey(c);
    const prev = byKey.get(k);
    if (prev) {
      prev.quoteSubmitted = prev.quoteSubmitted || c.quoteSubmitted;
      prev.quoteIds.push(...c.quoteIds);
    } else byKey.set(k, c);
  }
  const merged = [...byKey.entries()];

  // 발주전환: 같은 거래처+품번의 유상출고(시음일 이후)
  const clients = [...new Set(merged.map(([, c]) => c.client_code).filter(Boolean))];
  const items = [...new Set(merged.map(([, c]) => c.item_no).filter(Boolean))];
  const paid = new Map<string, string[]>();
  for (let i = 0; i < items.length; i += 300) {
    const { data: ps } = await supabase.from(shipTable)
      .select("client_code, item_no, ship_date")
      .in("client_code", clients).in("item_no", items.slice(i, i + 300))
      .gt("selling_price", 0).limit(20000);
    (ps || []).forEach((p: Row) => {
      const kk = `${p.client_code}|${p.item_no}`;
      const arr = paid.get(kk) || []; arr.push(ymd(p.ship_date)); paid.set(kk, arr);
    });
  }

  // 상신 여부(새 테이블)
  const subSet = new Set<string>();
  const { data: subs } = await supabase.from("tasting_submissions")
    .select("ship_date, client_code, item_no").eq("company", company);
  (subs || []).forEach((s: Row) => subSet.add(mkKey(s)));

  const rows: TastingLedgerRow[] = merged.map(([key, c]) => ({
    key, ship_date: c.ship_date, client_code: c.client_code, client_name: c.client_name,
    item_no: c.item_no, item_name: c.item_name, supply: c.supply, manager: c.manager,
    converted: (paid.get(`${c.client_code}|${c.item_no}`) || []).some((d) => d > c.ship_date),
    submitted: subSet.has(key) || c.quoteSubmitted,
    quoteIds: c.quoteIds,
  }));
  rows.sort((a, b) => (a.ship_date < b.ship_date ? 1 : a.ship_date > b.ship_date ? -1 : 0));
  return rows;
}

// 상신 키 파싱(company 포함 upsert/delete용)
export function parseKey(key: string): { ship_date: string; client_code: string; item_no: string } | null {
  const p = String(key || "").split("|");
  if (p.length !== 3 || !p[0]) return null;
  return { ship_date: p[0], client_code: p[1], item_no: p[2] };
}
