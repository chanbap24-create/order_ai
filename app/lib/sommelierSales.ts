// 소믈리에 판매 기록(서버 전용) — '판매 완료' 한 번 = sale_id 하나.
// 품목마다 와인 속성(타입·국가·지역·품종·브랜드·생산자)과 맛 프로필(무게감·당도·산미·탄닌·향)을
// 구매 시점 스냅샷으로 저장 → 문답 이력과 함께 손님 취향 학습의 뼈대 데이터.
import { supabase } from './db';
import { STORES, corpOfStore, vintageOfItemNo } from './store/types';

export type SaleItemInput = {
  item_no: string;
  item_name: string;
  qty: number;
  retail_price: number;  // 정상가
  sale_price: number;    // 백화점가(밴드 할인 적용)
  source?: 'quiz' | 'stock';
  rec_rank?: number | null;
};

export type SaleInput = {
  saleId: string;               // 클라이언트가 판매 완료 1회마다 생성(재시도 시 동일 → 중복 방지)
  customerId: number;
  storeKey: string;
  sessionId: number | null;     // 이 손님의 직전 문답 세션(있으면)
  extraRate: number;            // 추가 할인 %
  extraWon: number;             // 추가 할인 원
  items: SaleItemInput[];
  manager: string;
};

type WineSnap = {
  wine_type: string | null; country: string | null; region: string | null; grapes: string | null;
  brand: string | null; producer: string | null; vintage: string | null;
  body: number | null; sweetness: number | null; acidity: number | null; tannin: number | null; flavor_tags: string[] | null;
};

/** 와인 속성·맛 프로필 스냅샷 — wines + tasting_notes(품번 기준). 구매 기록·백필 공용 */
export async function wineSnapshots(itemNos: string[]): Promise<Map<string, WineSnap>> {
  const out = new Map<string, WineSnap>();
  const nos = [...new Set(itemNos)];
  for (let i = 0; i < nos.length; i += 200) {
    const batch = nos.slice(i, i + 200);
    const [{ data: wines }, { data: notes }] = await Promise.all([
      supabase.from('wines').select('item_code, vintage, country, region, wine_type, grape_varieties, brand, supplier').in('item_code', batch),
      supabase.from('tasting_notes').select('wine_id, body, sweetness, acidity, tannin, flavor_tags').in('wine_id', batch),
    ]);
    const noteOf = new Map((notes || []).map((n) => [String(n.wine_id), n]));
    for (const no of batch) {
      const w = (wines || []).find((x) => String(x.item_code) === no);
      const n = noteOf.get(no);
      const num = (v: unknown) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
      out.set(no, {
        wine_type: w?.wine_type || null, country: w?.country || null, region: w?.region || null,
        grapes: w?.grape_varieties || null, brand: w?.brand || null, producer: w?.supplier || null,
        vintage: vintageOfItemNo(no) ?? (w?.vintage ? String(w.vintage) : null),
        body: num(n?.body), sweetness: num(n?.sweetness), acidity: num(n?.acidity), tannin: num(n?.tannin),
        flavor_tags: Array.isArray(n?.flavor_tags) ? n.flavor_tags.map(String) : null,
      });
    }
  }
  return out;
}

/** 직전 문답 세션의 추천 결과 — 품번 → 순위(1부터). 구매가 추천에서 나왔는지 판정 */
async function recommendedRanks(sessionId: number | null, customerId: number): Promise<Map<string, number>> {
  const ranks = new Map<string, number>();
  if (!sessionId) return ranks;
  const { data } = await supabase.from('sommelier_sessions').select('results, customer_id').eq('id', sessionId).maybeSingle();
  if (!data || Number(data.customer_id) !== customerId) return ranks; // 다른 손님 세션 연결 방지
  (Array.isArray(data.results) ? data.results : []).forEach((r: { item_code?: string }, i: number) => {
    if (r?.item_code && !ranks.has(r.item_code)) ranks.set(r.item_code, i + 1);
  });
  return ranks;
}

export async function recordSale(s: SaleInput): Promise<{ ok: true; lines: number } | { ok: false; error: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(s.saleId)) return { ok: false, error: '판매 ID가 올바르지 않습니다.' };
  if (!STORES.some((x) => x.key === s.storeKey)) return { ok: false, error: '매장을 확인하세요.' };
  const items = s.items.filter((i) => i.item_no && i.qty > 0).slice(0, 100);
  if (!items.length) return { ok: false, error: '판매할 와인이 없습니다.' };
  const { data: customer } = await supabase.from('sommelier_customers').select('id').eq('id', s.customerId).maybeSingle();
  if (!customer) return { ok: false, error: '손님 정보를 찾을 수 없습니다.' };

  const [snaps, ranks] = await Promise.all([
    wineSnapshots(items.map((i) => i.item_no)),
    recommendedRanks(s.sessionId, s.customerId),
  ]);

  // 추가 할인(%·원)을 백화점가 비율로 품목에 배분 — 기록 매출 = 실제 결제액(10원 단위)
  const deptTotal = items.reduce((a, i) => a + i.sale_price * i.qty, 0);
  const afterRate = deptTotal * (1 - Math.min(100, Math.max(0, s.extraRate)) / 100);
  const finalTotal = Math.max(0, afterRate - Math.max(0, s.extraWon));
  const factor = deptTotal > 0 ? finalTotal / deptTotal : 1;

  const rows = items.map((i) => {
    const snap = snaps.get(i.item_no);
    const unit = Math.round((i.sale_price * factor) / 10) * 10;
    const rank = ranks.get(i.item_no) ?? null;
    return {
      sale_id: s.saleId, customer_id: s.customerId, session_id: s.sessionId, manager: s.manager,
      store_key: s.storeKey, corp: corpOfStore(s.storeKey),
      source: i.source === 'quiz' ? 'quiz' : 'stock',
      rec_rank: i.rec_rank ?? rank, recommended: rank != null,
      item_code: i.item_no, item_name: i.item_name.slice(0, 100), quantity: Math.floor(i.qty),
      list_price: i.retail_price, dept_price: i.sale_price, unit_price: unit, retail_price: unit, // retail_price=하위호환(최종 단가)
      discount_rate: i.retail_price > 0 ? Math.round((1 - unit / i.retail_price) * 1000) / 10 : 0,
      amount: unit * Math.floor(i.qty),
      extra_discount_rate: s.extraRate || 0, extra_discount_won: s.extraWon || 0,
      ...(snap || {}),
    };
  });
  const { error } = await supabase.from('sommelier_orders').upsert(rows, { onConflict: 'sale_id,item_code' });
  if (error) throw new Error(`구매 기록 실패: ${error.message}`);
  return { ok: true, lines: rows.length };
}
