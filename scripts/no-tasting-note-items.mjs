// 2025-08-01 이후 출고 품목 중 테이스팅 노트 없는 와인 목록 → 엑셀
// 빈티지 무시(품번 3~4자리 제거) 기준으로 노트 매칭. 자재/세트/특판/더미는 별도 시트.
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const baseKey = (c) => (c && c.length >= 5 ? c.slice(0, 2) + c.slice(4) : c);

// 출고 집계 (2025-08-01~, 수량>0)
const agg = new Map();
for (let off = 0; ; off += 1000) {
  const { data, error } = await supabase.from('shipments')
    .select('item_no, item_name, quantity, supply_amount, client_code, ship_date')
    .gte('ship_date', '2025-08-01').gt('quantity', 0)
    .order('id', { ascending: true }).range(off, off + 999);
  if (error) throw error;
  if (!data?.length) break;
  for (const r of data) {
    if (!r.item_no) continue;
    const a = agg.get(r.item_no) || { name: '', qty: 0, amt: 0, clients: new Set(), last: '' };
    a.name = r.item_name || a.name;
    a.qty += r.quantity || 0;
    a.amt += r.supply_amount || 0;
    if (r.client_code) a.clients.add(r.client_code);
    if (r.ship_date > a.last) a.last = r.ship_date;
    agg.set(r.item_no, a);
  }
  if (data.length < 1000) break;
}

// 노트 보유 베이스 품번
const notedBase = new Set();
for (let off = 0; ; off += 1000) {
  const { data, error } = await supabase.from('tasting_notes')
    .select('wine_id, nose_note, palate_note').range(off, off + 999);
  if (error) throw error;
  if (!data?.length) break;
  for (const n of data) if (n.nose_note || n.palate_note) notedBase.add(baseKey(n.wine_id));
  if (data.length < 1000) break;
}

// 자재/세트/특판/더미 판별
const NON_WINE_RE = /(케이스|쇼핑백|지함|에어팩|박스|오프너|버킷|버켓|스토퍼|칠러백|더미|배송비|디스플레이|진열장|와인렉|햄퍼|담요|냅킨|에코백|의자|택배|시음컵|글로리파이어|테이블크로스|거치대|선반|캡$|펜$|폴더|트렁크|세트$|리저베이션)/;
const isNonWine = (code, name) =>
  /^[89]/i.test(code) || /^7/.test(code) || /^0000/.test(code) || NON_WINE_RE.test(name || '');

// 같은 와인의 빈티지별 품번은 베이스 품번으로 합산(노트는 와인당 1건이면 전 빈티지 커버)
const wineBase = new Map(), etc = [];
for (const [code, a] of agg) {
  if (code.length < 5 || notedBase.has(baseKey(code))) continue;
  if (isNonWine(code, a.name)) { etc.push([code, a.name, a.qty, Math.round(a.amt), a.clients.size, a.last]); continue; }
  const b = wineBase.get(baseKey(code)) || { codes: [], name: '', qty: 0, amt: 0, clients: new Set(), last: '' };
  b.codes.push(code);
  if (a.amt >= (b.topAmt || 0)) { b.name = a.name; b.topAmt = a.amt; }
  b.qty += a.qty; b.amt += a.amt;
  for (const c of a.clients) b.clients.add(c);
  if (a.last > b.last) b.last = a.last;
  wineBase.set(baseKey(code), b);
}
const wines = [...wineBase.values()]
  .map(b => [b.codes.sort().join(', '), b.name, b.qty, Math.round(b.amt), b.clients.size, b.last])
  .sort((x, y) => y[3] - x[3]);
etc.sort((x, y) => y[3] - x[3]);

const wb = new ExcelJS.Workbook();
const HEAD = ['품번', '품명', '수량', '공급가액', '거래처수', '최근출고일'];
for (const [title, rows] of [['노트없는 와인', wines], ['자재·세트·특판(제외분)', etc]]) {
  const ws = wb.addWorksheet(title);
  ws.addRow(HEAD).font = { bold: true };
  rows.forEach(r => ws.addRow(r));
  ws.getColumn(2).width = 55; ws.getColumn(1).width = 12;
  ws.getColumn(4).numFmt = '#,##0'; ws.getColumn(4).width = 14;
  ws.getColumn(6).width = 12;
}
const out = `${process.env.HOME}/Downloads/노트없는품목_2025-08이후.xlsx`;
await wb.xlsx.writeFile(out);
console.log(`와인 ${wines.length}개 · 자재/세트 ${etc.length}개 → ${out}`);
