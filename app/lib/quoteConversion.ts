// 견적 → 실제 출고 전환 계산. saved_quotes ↔ shipments 를 (거래처 × 품번 × 기간)으로 조인.
// 별도 저장 없이 실시간 계산(출고 동기화에 항상 최신). 기본 전환 인정 기간 = 60일.
import { supabase } from '@/app/lib/db';
import { getSavedQuote } from '@/app/lib/savedQuotes';

const DEFAULT_WINDOW_DAYS = 60;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

/** 'YYYY-MM-DD' + N일 */
function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const itemName = (it: AnyRow): string =>
  it.product_name || it.korean_name || it.english_name || it.item_code || '';

// 프로모션 가상 거래처: 매월 전체 발송분을 견적서로 기록한다.
// 전 거래처 대상이므로 전환은 거래처를 가리지 않고 전 거래처 출고로 집계한다.
const PROMO_CLIENT_CODES: Record<string, 'wine' | 'glass'> = {
  'PROMO-CDV': 'wine',
  'PROMO-DL': 'glass',
};
export const isPromoClient = (code: string | null | undefined): boolean =>
  !!code && code in PROMO_CLIENT_CODES;

export interface QuoteConversionItem {
  item_code: string;
  name: string;
  quoted_qty: number;
  shipped_qty: number;
  converted: boolean;
  last_ship: string | null;
}

/** 단일 저장 견적의 항목별 출고 전환(견적일 ~ +window일). */
export async function getQuoteConversion(id: number, windowDays = DEFAULT_WINDOW_DAYS) {
  const sq = await getSavedQuote(id);
  if (!sq) throw new Error('견적을 찾을 수 없습니다.');
  const items: AnyRow[] = Array.isArray(sq.items) ? sq.items : [];
  const code: string | null = sq.client_code || null;
  const start = String(sq.created_at).slice(0, 10);
  const end = addDays(start, windowDays);

  const shipTable = sq.company === 'DL' ? 'glass_shipments' : 'shipments';
  const shipMap = new Map<string, { qty: number; last: string }>();
  const codes = items.map((it) => it.item_code).filter(Boolean);
  const isPromo = isPromoClient(code);
  if (code && codes.length) {
    let q = supabase
      .from(shipTable)
      .select('item_no, quantity, ship_date')
      .in('item_no', codes)
      .gte('ship_date', start)
      .lte('ship_date', end);
    if (!isPromo) q = q.eq('client_code', code); // 프로모션은 전 거래처 출고로 매칭
    const { data } = await q;
    for (const s of (data || []) as AnyRow[]) {
      const m = shipMap.get(s.item_no) || { qty: 0, last: '' };
      m.qty += Number(s.quantity) || 0;
      if (String(s.ship_date) > m.last) m.last = String(s.ship_date);
      shipMap.set(s.item_no, m);
    }
  }

  const outItems: QuoteConversionItem[] = items.map((it) => {
    const m = shipMap.get(it.item_code);
    const shipped = m?.qty || 0;
    return {
      item_code: it.item_code,
      name: itemName(it),
      quoted_qty: Number(it.quantity) || 0,
      shipped_qty: shipped,
      converted: shipped > 0,
      last_ship: m?.last || null,
    };
  });

  const converted = outItems.filter((i) => i.converted).length;
  const quotedQty = outItems.reduce((s, i) => s + i.quoted_qty, 0);
  const shippedQty = outItems.reduce((s, i) => s + i.shipped_qty, 0);
  return {
    client_code: code,
    client_name: sq.client_name,
    window_days: windowDays,
    matchable: !!code,
    summary: {
      total: outItems.length,
      converted,
      quoted_qty: quotedQty,
      shipped_qty: shippedQty,
      rate: outItems.length ? Math.round((converted / outItems.length) * 100) : 0,
    },
    items: outItems,
  };
}

export interface ClientConversionWine {
  item_code: string;
  name: string;
  quoted_count: number;    // 견적에 포함된 횟수
  converted_count: number; // 그 중 기간 내 출고된 횟수
  quoted_qty: number;
  shipped_qty: number;
  last_ship: string | null;
}

/**
 * 거래처의 모든 저장 견적을 합산한 와인별 전환.
 * "이 거래처에 과거 견적한 와인 중 실제로 팔린 것" — 다음 견적 작성 시 참고용.
 */
export async function getClientConversion(
  clientCode: string,
  windowDays = DEFAULT_WINDOW_DAYS,
  type?: 'wine' | 'glass',
) {
  const isPromo = isPromoClient(clientCode);
  const effType = isPromo ? PROMO_CLIENT_CODES[clientCode] : type;
  const shipTable = effType === 'glass' ? 'glass_shipments' : 'shipments';
  let qq = supabase
    .from('saved_quotes')
    .select('items, created_at')
    .eq('client_code', clientCode);
  if (type) qq = qq.eq('company', type === 'glass' ? 'DL' : 'CDV');
  const { data: quotes } = await qq.order('created_at', { ascending: true });

  const qList = (quotes || []) as AnyRow[];
  if (qList.length === 0) {
    return { summary: { quotes: 0, wines: 0, converted_wines: 0, rate: 0 }, wines: [] as ClientConversionWine[] };
  }

  // 견적된 품번 union + 가장 이른 견적일
  const allCodes = new Set<string>();
  let earliest = '9999-99-99';
  for (const q of qList) {
    for (const it of (q.items || []) as AnyRow[]) if (it.item_code) allCodes.add(it.item_code);
    const d = String(q.created_at).slice(0, 10);
    if (d < earliest) earliest = d;
  }

  // 거래처의 해당 품번 출고 일괄 조회(가장 이른 견적일 이후), 200개씩 배치
  const codeArr = [...allCodes];
  const shipByCode = new Map<string, { date: string; qty: number }[]>();
  for (let i = 0; i < codeArr.length; i += 200) {
    let q = supabase
      .from(shipTable)
      .select('item_no, quantity, ship_date')
      .in('item_no', codeArr.slice(i, i + 200))
      .gte('ship_date', earliest);
    if (!isPromo) q = q.eq('client_code', clientCode); // 프로모션은 전 거래처 출고로 매칭
    const { data } = await q;
    for (const s of (data || []) as AnyRow[]) {
      const arr = shipByCode.get(s.item_no) || [];
      arr.push({ date: String(s.ship_date), qty: Number(s.quantity) || 0 });
      shipByCode.set(s.item_no, arr);
    }
  }

  const wineMap = new Map<string, ClientConversionWine>();
  for (const q of qList) {
    const start = String(q.created_at).slice(0, 10);
    const end = addDays(start, windowDays);
    for (const it of (q.items || []) as AnyRow[]) {
      if (!it.item_code) continue;
      const w = wineMap.get(it.item_code) || {
        item_code: it.item_code, name: itemName(it),
        quoted_count: 0, converted_count: 0, quoted_qty: 0, shipped_qty: 0, last_ship: null,
      };
      w.quoted_count++;
      w.quoted_qty += Number(it.quantity) || 0;
      const ships = (shipByCode.get(it.item_code) || []).filter((s) => s.date >= start && s.date <= end);
      const qty = ships.reduce((a, b) => a + b.qty, 0);
      if (qty > 0) {
        w.converted_count++;
        w.shipped_qty += qty;
        const last = ships.map((s) => s.date).sort().pop() || null;
        if (last && (!w.last_ship || last > w.last_ship)) w.last_ship = last;
      }
      wineMap.set(it.item_code, w);
    }
  }

  const wines = [...wineMap.values()].sort(
    (a, b) => b.converted_count - a.converted_count || b.quoted_count - a.quoted_count,
  );
  const convertedWines = wines.filter((w) => w.converted_count > 0).length;
  return {
    summary: {
      quotes: qList.length,
      wines: wines.length,
      converted_wines: convertedWines,
      rate: wines.length ? Math.round((convertedWines / wines.length) * 100) : 0,
    },
    wines,
  };
}
