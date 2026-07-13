// 노트 없는 와인을 품명 그룹(빈티지 통합)으로 매출 랭킹 → 조사 대상 품번 선정.
// 같은 베이스 품번이라도 다른 와인이 섞이는 충돌이 있어 '품명' 기준으로 그룹한다.
// 사용: node scripts/select-research-targets.mjs <개수>
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const N = parseInt(process.argv[2] || '60', 10);
const baseKey = (c) => (c && c.length >= 5 ? c.slice(0, 2) + c.slice(4) : c);

// 출고 집계
const agg = new Map();
for (let off = 0; ; off += 1000) {
  const { data, error } = await supabase.from('shipments')
    .select('item_no, item_name, quantity, supply_amount')
    .gte('ship_date', '2025-08-01').gt('quantity', 0)
    .order('id', { ascending: true }).range(off, off + 999);
  if (error) throw error;
  if (!data?.length) break;
  for (const r of data) {
    if (!r.item_no) continue;
    const a = agg.get(r.item_no) || { name: '', amt: 0 };
    a.name = r.item_name || a.name;
    a.amt += r.supply_amount || 0;
    agg.set(r.item_no, a);
  }
  if (data.length < 1000) break;
}

// 노트 보유 베이스
const notedBase = new Set();
for (let off = 0; ; off += 1000) {
  const { data } = await supabase.from('tasting_notes')
    .select('wine_id, nose_note, palate_note').range(off, off + 999);
  if (!data?.length) break;
  for (const n of data) if (n.nose_note || n.palate_note) notedBase.add(baseKey(n.wine_id));
  if (data.length < 1000) break;
}

const NON_WINE_RE = /(케이스|쇼핑백|지함|에어팩|박스|오프너|버킷|버켓|스토퍼|칠러백|더미|배송비|디스플레이|진열장|와인렉|햄퍼|담요|냅킨|에코백|의자|택배|시음컵|글로리파이어|테이블크로스|거치대|선반|캡$|펜$|폴더|트렁크|리저베이션)/;
const isNonWine = (code, name) =>
  /^[89]/i.test(code) || /^7/.test(code) || /^0000/.test(code) || NON_WINE_RE.test(name || '');

// 품명 그룹(빈티지 통합) 랭킹
const groups = new Map();
for (const [code, a] of agg) {
  if (code.length < 5 || notedBase.has(baseKey(code)) || isNonWine(code, a.name)) continue;
  const key = (a.name || '').trim();
  if (!key) continue;
  const g = groups.get(key) || { amt: 0, codes: [] };
  g.amt += a.amt;
  g.codes.push([code, a.amt]);
  groups.set(key, g);
}
const ranked = [...groups.entries()].sort((a, b) => b[1].amt - a[1].amt).slice(0, N);

// 대표 품번: wines에 영문명 있는 것 중 매출 최대
const allCodes = ranked.flatMap(([, g]) => g.codes.map(c => c[0]));
const enMap = new Map();
for (let i = 0; i < allCodes.length; i += 300) {
  const { data } = await supabase.from('wines')
    .select('item_code, item_name_en').in('item_code', allCodes.slice(i, i + 300));
  for (const w of (data || [])) if (w.item_name_en?.trim()) enMap.set(w.item_code, w.item_name_en);
}

const picks = [], skipped = [];
for (const [name, g] of ranked) {
  const withEn = g.codes.filter(([c]) => enMap.has(c)).sort((a, b) => b[1] - a[1]);
  if (withEn.length) picks.push({ code: withEn[0][0], name, amt: g.amt });
  else skipped.push({ name, amt: g.amt, codes: g.codes.map(c => c[0]).join('/') });
}

console.log('=== 조사 대상 ===');
picks.forEach((p, i) => console.log(`${i + 1}. ${p.code} | ${p.name} | ${Math.round(p.amt).toLocaleString()}`));
console.log('\n=== 영문명 없어 제외(수동 필요) ===');
skipped.forEach(s => console.log(`- ${s.codes} | ${s.name} | ${Math.round(s.amt).toLocaleString()}`));
console.log('\nCODES=' + picks.map(p => p.code).join(' '));
