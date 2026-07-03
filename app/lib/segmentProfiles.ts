// 업장유형·지역별 구매 프로파일: 신규 거래처(이력 0) 추천용.
// refreshSegmentProfiles()로 최근 12개월 출고를 집계해 segment_profiles 테이블에 upsert.
import { supabase } from './db';
import { normalizeType, bucketLabel } from '@/app/api/sales/recommend/lib/wineType';
import { VENUE_MAP } from './venueTypes';

export interface SegmentTopItem { item_no: string; name: string; breadth: number; qty: number }
export interface SegmentProfile {
  segment_type: string; segment_key: string; label: string;
  client_count: number; bottle_count: number;
  price_median: number; price_p25: number; price_p75: number;
  type_dist: Record<string, number>;
  top_countries: { country: string; share: number }[];
  top_items: SegmentTopItem[];
}

const SIDO = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
/** 주소 → "시도 시군구"(예: 서울 강남구). 못 뽑으면 ''. */
export function extractRegion(address?: string | null): string {
  if (!address) return '';
  const sido = SIDO.find((s) => address.includes(s)) || '';
  const m = address.replace(/특별자치시|특별자치도|특별시|광역시/g, '').match(/([가-힣]{1,10}?[구시군])(?:\s|$)/);
  const gu = m ? m[1] : '';
  return sido && gu ? `${sido} ${gu}` : (sido || gu || '');
}

function wPercentile(arr: { p: number; w: number }[], q: number): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a.p - b.p);
  const total = s.reduce((x, y) => x + y.w, 0);
  let c = 0; for (const x of s) { c += x.w; if (c >= total * q) return x.p; }
  return s[s.length - 1].p;
}

async function pageAll<T>(table: string, sel: string, build: (q: PostgrestQ) => PostgrestQ): Promise<T[]> {
  const out: T[] = []; let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const q = build(supabase.from(table).select(sel).range(from, from + 999) as unknown as PostgrestQ);
    const { data } = await (q as unknown as Promise<{ data: T[] | null }>);
    if (!data || !data.length) break;
    out.push(...data); if (data.length < 1000) break; from += 1000;
  }
  return out;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PostgrestQ = any;

interface Agg { clients: Set<string>; qty: number; prices: { p: number; w: number }[]; types: Record<string, number>; countries: Record<string, number>; items: Record<string, { name: string; qty: number; clients: Set<string> }> }
const mkAgg = (): Agg => ({ clients: new Set(), qty: 0, prices: [], types: {}, countries: {}, items: {} });

/** 최근 12개월 출고를 업장유형·지역별로 집계해 segment_profiles 갱신. */
export async function refreshSegmentProfiles(): Promise<{ venues: number; regions: number; lines: number }> {
  const since = new Date(); since.setMonth(since.getMonth() - 12); const sinceStr = since.toISOString().slice(0, 10);
  const [clients, venues, wines, ships] = await Promise.all([
    pageAll<{ client_code: string; address: string | null }>('client_details', 'client_code,address', (q) => q.eq('client_type', 'wine')),
    pageAll<{ client_code: string; venue: string }>('client_venue', 'client_code,venue', (q) => q.eq('client_type', 'wine')),
    pageAll<{ item_code: string; wine_type: string; country: string; country_en: string; item_name_kr: string }>('wines', 'item_code,wine_type,country,country_en,item_name_kr', (q) => q),
    pageAll<{ client_code: string; item_no: string; item_name: string; unit_price: number; quantity: number }>('shipments', 'client_code,item_no,item_name,unit_price,quantity', (q) => q.gte('ship_date', sinceStr).not('client_code', 'is', null)),
  ]);

  const regionOf = new Map<string, string>(); for (const c of clients) regionOf.set(String(c.client_code), extractRegion(c.address));
  const venueOf = new Map<string, string>(); for (const v of venues) venueOf.set(String(v.client_code), v.venue);
  const wineOf = new Map<string, typeof wines[number]>(); for (const w of wines) wineOf.set(String(w.item_code), w);

  const byVenue = new Map<string, Agg>();
  const byRegion = new Map<string, Agg>();
  const addTo = (m: Map<string, Agg>, key: string, code: string, s: typeof ships[number], w?: typeof wines[number]) => {
    if (!key) return;
    const a = m.get(key) || (m.set(key, mkAgg()), m.get(key)!);
    a.clients.add(code);
    const qty = Number(s.quantity) || 0; const price = Number(s.unit_price) || 0;
    if (qty <= 0) return; // 반품·0수량은 볼륨 집계 제외(거래처 수엔 이미 반영)
    a.qty += qty;
    if (price > 0) a.prices.push({ p: price, w: qty });
    const tl = bucketLabel(normalizeType(w?.wine_type || '', w?.item_name_kr || s.item_name || '')) || '기타';
    a.types[tl] = (a.types[tl] || 0) + qty;
    const country = (w?.country || w?.country_en || '기타').trim() || '기타'; a.countries[country] = (a.countries[country] || 0) + qty;
    const nm = w?.item_name_kr || s.item_name || s.item_no; const it = a.items[s.item_no] || (a.items[s.item_no] = { name: nm, qty: 0, clients: new Set() }); it.qty += qty; it.clients.add(code);
  };
  for (const s of ships) {
    const code = String(s.client_code); const w = wineOf.get(String(s.item_no));
    const ven = venueOf.get(code); if (ven) addTo(byVenue, ven, code, s, w);
    const reg = regionOf.get(code); if (reg) addTo(byRegion, reg, code, s, w);
  }

  const toRow = (segmentType: string, key: string, label: string, a: Agg) => {
    const totQty = Object.values(a.types).reduce((x, y) => x + y, 0) || 1;
    const type_dist: Record<string, number> = {};
    for (const [t, q] of Object.entries(a.types)) type_dist[t] = Math.round(q / totQty * 1000) / 1000;
    const totC = Object.values(a.countries).reduce((x, y) => x + y, 0) || 1;
    const top_countries = Object.entries(a.countries).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([country, q]) => ({ country, share: Math.round(q / totC * 1000) / 1000 }));
    const top_items = Object.entries(a.items).map(([item_no, v]) => ({ item_no, name: v.name, breadth: v.clients.size, qty: v.qty }))
      .sort((x, y) => y.breadth - x.breadth || y.qty - x.qty).slice(0, 15);
    return {
      segment_type: segmentType, segment_key: key, label,
      client_count: a.clients.size, bottle_count: a.qty,
      price_median: Math.round(wPercentile(a.prices, 0.5)), price_p25: Math.round(wPercentile(a.prices, 0.25)), price_p75: Math.round(wPercentile(a.prices, 0.75)),
      type_dist, top_countries, top_items, updated_at: new Date().toISOString(),
    };
  };

  const rows = [
    ...[...byVenue.entries()].filter(([, a]) => a.clients.size >= 2).map(([k, a]) => toRow('venue', k, VENUE_MAP[k]?.label || k, a)),
    ...[...byRegion.entries()].filter(([, a]) => a.clients.size >= 3).map(([k, a]) => toRow('region', k, k, a)),
  ];
  // 전체 삭제 후 재삽입(세그먼트가 사라진 경우 정리)
  await supabase.from('segment_profiles').delete().not('segment_key', 'is', null);
  for (let i = 0; i < rows.length; i += 200) await supabase.from('segment_profiles').insert(rows.slice(i, i + 200));

  return { venues: byVenue.size, regions: byRegion.size, lines: ships.length };
}

/** 추천용 단건 조회. */
export async function getSegmentProfile(segmentType: 'venue' | 'region', key: string): Promise<SegmentProfile | null> {
  if (!key) return null;
  const { data } = await supabase.from('segment_profiles').select('*').eq('segment_type', segmentType).eq('segment_key', key).maybeSingle();
  return (data as SegmentProfile) || null;
}
