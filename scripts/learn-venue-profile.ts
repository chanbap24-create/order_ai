/**
 * 업장 유형별 와인 선호 '등급 점수' 자동 학습 → venue_wine_profile 테이블.
 *   타입  = 절대 비중(그 업장이 실제로 많이 사는 타입) → 0~8
 *   국가  = lift(전체 대비 배수) + 표본 shrinkage → 0~8   (편중 제거: 프랑스 8 뭉개짐 방지)
 *   지역  = lift + shrinkage, key=산지계층 문자열 그대로 → 0~4  (한/영 이슈 소멸)
 * 사용: npx -y tsx scripts/learn-venue-profile.ts [--apply]   (--apply 없으면 미리보기, 테이블 미기록)
 */
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
/* eslint-disable @typescript-eslint/no-explicit-any */

const K_SHRINK = 25;   // 표본 shrinkage(병수). 작을수록 데이터 신뢰↑
// 국가/지역: 순수 lift(비율)는 희소표본에서 폭주 → '초과비중(excess=업장비중−전체비중)'으로 견고화.
const EXCESS_FULL_C = 0.12; // 국가: 전체보다 +12%p 이상이면 만점
const EXCESS_FULL_R = 0.08; // 지역: +8%p 이상이면 만점
const MIN_QTY_C = 15;       // 국가 최소 물량(병) — 이하면 노이즈로 제외
const MIN_QTY_R = 10;       // 지역 최소 물량(병)
const TYPE_ORDER = ['sparkling', 'white', 'red', 'rose', 'fortified'];
const TYPE_KR: Record<string, string> = { sparkling: '스파클링', white: '화이트', red: '레드', rose: '로제', fortified: '주정강화' };

function gradeAbsolute(dist: Map<string, number>, max: number, minPts: number) {
  const es = [...dist.entries()].sort((a, b) => b[1] - a[1]);
  if (!es.length) return [] as { k: string; pts: number }[];
  const top = es[0][1];
  return es.map(([k, v]) => ({ k, pts: Math.round(max * v / top) })).filter((x) => x.pts >= minPts);
}
// 초과비중 기반: 업장비중이 전체비중을 얼마나 넘느냐(+ 표본 shrinkage). 희소 산지 폭주 방지.
function gradeExcess(dist: Map<string, number>, venueTot: number, base: Map<string, number>, baseTot: number, max: number, topN: number, minPts: number, excessFull: number, minQty: number) {
  const out: { k: string; pts: number; lift: number }[] = [];
  for (const [k, q] of dist) {
    if (q < minQty) continue;
    const vShare = q / venueTot;
    const bShare = (base.get(k) || 0) / baseTot;
    const excess = vShare - bShare;
    if (excess <= 0) continue;
    const shrink = q / (q + K_SHRINK);
    const pts = Math.round(max * Math.min(1, excess / excessFull) * shrink);
    if (pts >= minPts) out.push({ k, pts, lift: Math.round((vShare / (bShare || 1)) * 100) / 100 });
  }
  return out.sort((a, b) => b.pts - a.pts || b.lift - a.lift).slice(0, topN);
}

async function main() {
  const apply = process.argv.includes('--apply');
  const { supabase } = await import('@/app/lib/db');
  const { normalizeType } = await import('@/app/api/sales/recommend/lib/wineType');
  const { findHierarchy } = await import('@/app/api/sales/recommend/lib/regions');
  const { fetchAll } = await import('@/app/api/sales/recommend/lib/fetchers');
  const { VENUE_MAP } = await import('@/app/lib/venueTypes');

  const regionRows = await fetchAll<any>('wine_regions', 'country, sub_region, major_region, appellation, cru_vineyard, classification');
  const { data: cv } = await supabase.from('client_venue').select('client_code, venue').eq('client_type', 'wine');
  const venueOf = new Map<string, string>(); const codes: string[] = [];
  for (const r of cv || []) { venueOf.set(String((r as any).client_code), (r as any).venue); codes.push(String((r as any).client_code)); }

  // 출고 + 와인속성/계층
  const ship: { venue: string; item: string; qty: number }[] = []; const items = new Set<string>();
  for (let i = 0; i < codes.length; i += 80) {
    const b = codes.slice(i, i + 80);
    for (let off = 0; off < 200000; off += 1000) {
      const { data } = await supabase.from('shipments').select('client_code,item_no,quantity').in('client_code', b).range(off, off + 999);
      if (!data || !data.length) break;
      for (const s of data as any[]) { const v = venueOf.get(String(s.client_code)); if (v && s.item_no) { ship.push({ venue: v, item: String(s.item_no), qty: Number(s.quantity) || 0 }); items.add(String(s.item_no)); } }
      if (data.length < 1000) break;
    }
  }
  const wine = new Map<string, { bucket: string; country: string; region: string }>();
  const ia = [...items];
  for (let i = 0; i < ia.length; i += 400) {
    const { data } = await supabase.from('wines').select('item_code,wine_type,item_name_kr,item_name_en,country,country_en,region').in('item_code', ia.slice(i, i + 400));
    for (const w of data as any[] || []) {
      const h = findHierarchy(w.region || '', `${w.item_name_kr || ''} ${w.item_name_en || ''}`, regionRows as any, w.country_en || w.country || '');
      wine.set(String(w.item_code), { bucket: normalizeType(w.wine_type || '', w.item_name_kr || ''), country: w.country || '', region: (h?.super_region || h?.major_region || '').trim() });
    }
  }

  // 집계: 전체(baseline) + 업장별
  const base = { t: new Map<string, number>(), c: new Map<string, number>(), r: new Map<string, number>(), tot: { t: 0, c: 0, r: 0 } };
  const per = new Map<string, { t: Map<string, number>; c: Map<string, number>; r: Map<string, number>; tot: { t: number; c: number; r: number }; clients: Set<string> }>();
  for (const s of ship) {
    const w = wine.get(s.item); if (!w) continue;
    if (!per.has(s.venue)) per.set(s.venue, { t: new Map(), c: new Map(), r: new Map(), tot: { t: 0, c: 0, r: 0 }, clients: new Set() });
    const p = per.get(s.venue)!;
    const add = (mv: Map<string, number>, mb: Map<string, number>, key: string, axis: 't' | 'c' | 'r') => {
      if (!key) return; mv.set(key, (mv.get(key) || 0) + s.qty); mb.set(key, (mb.get(key) || 0) + s.qty); p.tot[axis] += s.qty; base.tot[axis] += s.qty;
    };
    add(p.t, base.t, w.bucket, 't'); add(p.c, base.c, w.country, 'c'); add(p.r, base.r, w.region, 'r');
  }

  // 등급 산출
  const rows: any[] = []; const dbRows: any[] = [];
  for (const [venue, p] of [...per.entries()].sort((a, b) => b[1].tot.t - a[1].tot.t)) {
    const types = gradeAbsolute(p.t, 8, 2).sort((a, b) => TYPE_ORDER.indexOf(a.k) - TYPE_ORDER.indexOf(b.k));
    const countries = gradeExcess(p.c, p.tot.c, base.c, base.tot.c, 8, 4, 2, EXCESS_FULL_C, MIN_QTY_C);
    const regions = gradeExcess(p.r, p.tot.r, base.r, base.tot.r, 4, 5, 1, EXCESS_FULL_R, MIN_QTY_R);
    rows.push({ venue, label: VENUE_MAP[venue]?.label || venue, qty: p.tot.t, types, countries, regions });
    for (const x of types) dbRows.push({ venue, axis: 'type', key: x.k, points: x.pts });
    for (const x of countries) dbRows.push({ venue, axis: 'country', key: x.k, points: x.pts });
    for (const x of regions) dbRows.push({ venue, axis: 'region', key: x.k, points: x.pts });
  }

  // 출력
  console.log(`학습 업장 ${rows.length}종 · 출고행 ${ship.length} · baseline 병수 ${base.tot.t}\n`);
  for (const r of rows) {
    console.log(`▸ ${r.label} (${r.qty}병)`);
    console.log(`   타입 : ${r.types.map((x: any) => `${TYPE_KR[x.k]} ${x.pts}`).join(' · ') || '-'}`);
    console.log(`   국가 : ${r.countries.map((x: any) => `${x.k} ${x.pts}(×${x.lift})`).join(' · ') || '-'}`);
    console.log(`   지역 : ${r.regions.map((x: any) => `${x.k} ${x.pts}(×${x.lift})`).join(' · ') || '-'}`);
  }

  if (apply) {
    await supabase.from('venue_wine_profile').delete().neq('venue', '__none__');
    for (let i = 0; i < dbRows.length; i += 500) await supabase.from('venue_wine_profile').insert(dbRows.slice(i, i + 500));
    console.log(`\n✅ venue_wine_profile 기록: ${dbRows.length}행`);
  } else {
    console.log(`\n(미리보기 — 테이블 미기록. --apply 로 ${dbRows.length}행 저장)`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error('FAIL:', e); process.exit(1); });
