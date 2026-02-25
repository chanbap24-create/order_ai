// 거래처별제품별입고현황 데이터를 shipments/glass_shipments에 추가 (중복 제외)
// 매출 데이터 파일에서 name→code 매핑 구축 후 거래처별 데이터 중 신규 행만 INSERT

const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function toStr(v) { return String(v ?? '').trim(); }
function toCode(v) { return String(v ?? '').trim().replace(/\.0$/, ''); }
function toNum(v) {
  if (v == null) return null;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isFinite(n) ? n : null;
}
function parseDate(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  if (/^\d{8}$/.test(s)) return s.slice(0,4) + '-' + s.slice(4,6) + '-' + s.slice(6,8);
  if (typeof v === 'number' && v > 30000) {
    const d = new Date((v - 25569) * 86400000);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(s)) return s.replace(/\//g, '-');
  return null;
}

function makeKey(date, clientName, itemNo, qty) {
  return `${date}|${clientName}|${itemNo}|${qty}`;
}

async function run() {
  const fs = require('fs');

  // ── Step 1: 매출 데이터에서 name→code 매핑 + 중복체크 키 Set 구축 ──
  console.log('=== Step 1: 매출 데이터 매핑 구축 ===');

  // CDV name→code
  const cdvNameToCode = new Map();
  const cdvKeys = new Set();
  {
    const buf = fs.readFileSync('sample/매출 데이터(20년 부터)-cdv.xlsx');
    const wb = XLSX.read(buf, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
    console.log(`CDV 매출 데이터: ${rows.length - 1} rows`);
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const code = toCode(r[4]);
      const name = toStr(r[5]);
      const date = parseDate(r[0]);
      const itemNo = toCode(r[8]);
      const qty = toNum(r[13]) ?? 0;
      if (code && name) cdvNameToCode.set(name, code);
      if (date && itemNo) cdvKeys.add(makeKey(date, name, itemNo, qty));
    }
    console.log(`  name→code: ${cdvNameToCode.size}, 키: ${cdvKeys.size}`);
  }

  // DL name→code
  const dlNameToCode = new Map();
  const dlKeys = new Set();
  {
    const buf = fs.readFileSync('sample/매출 데이터(20년 부터)-DL.xlsx');
    const wb = XLSX.read(buf, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
    console.log(`DL 매출 데이터: ${rows.length - 1} rows`);
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const code = toCode(r[4]);
      const name = toStr(r[5]);
      const date = parseDate(r[0]);
      const itemNo = toCode(r[8]);
      const qty = toNum(r[13]) ?? 0;
      if (code && name) dlNameToCode.set(name, code);
      if (date && itemNo) dlKeys.add(makeKey(date, name, itemNo, qty));
    }
    console.log(`  name→code: ${dlNameToCode.size}, 키: ${dlKeys.size}`);
  }

  // ── Step 2: 거래처별 파일 읽기 ──
  console.log('\n=== Step 2: 거래처별제품별입고현황 읽기 ===');
  const mainBuf = fs.readFileSync('sample/거래처별제품별입고현황(200101~250731).xlsx');
  const mainWb = XLSX.read(mainBuf, { type: 'buffer' });
  console.log('시트:', mainWb.SheetNames);

  // ── Step 3: CDV 시트 → shipments 추가 ──
  const cdvSheet = mainWb.SheetNames.find(s => /cdv/i.test(s)) || mainWb.SheetNames[0];
  console.log(`\n=== Step 3: CDV 시트 (${cdvSheet}) → shipments ===`);
  {
    const rows = XLSX.utils.sheet_to_json(mainWb.Sheets[cdvSheet], { header: 1, defval: '' });
    // 헤더 확인
    console.log('  헤더:', rows[0]?.slice(0, 17).join(' | '));

    const newRows = [];
    let skipped = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      // 거래처별 컬럼: 0:판매일자 1:출고일자 2:거래처명 3:판매원 4:품목(코드) 5:품목명 6:용량 7:수량 8:단가 9:금액 10:공급가 11:도매장가 12:할인금액 13:할인율 14:비고 15:ENAME 16:납품처
      const shipDate = parseDate(r[1]) || parseDate(r[0]);
      const clientName = toStr(r[16]) || toStr(r[2]); // 납품처 우선, 없으면 거래처명
      const itemNo = toCode(r[4]);
      const itemName = toStr(r[5]);
      const qty = toNum(r[7]) ?? 0;

      if (!shipDate || !itemNo) continue;

      const key = makeKey(shipDate, clientName, itemNo, qty);
      if (cdvKeys.has(key)) { skipped++; continue; }
      cdvKeys.add(key); // prevent self-duplicates

      const clientCode = cdvNameToCode.get(clientName) || null;
      newRows.push({
        client_name: clientName,
        client_code: clientCode,
        ship_date: shipDate,
        item_no: itemNo,
        item_name: itemName,
        quantity: qty,
        unit_price: toNum(r[8]),
        selling_price: toNum(r[9]),
        supply_amount: toNum(r[10]),
        manager: toStr(r[3]) || null,
      });
    }
    console.log(`  파싱: ${rows.length - 1}행, 중복 스킵: ${skipped}, 신규: ${newRows.length}`);

    // INSERT in batches
    let inserted = 0;
    const BATCH = 500;
    for (let i = 0; i < newRows.length; i += BATCH) {
      const batch = newRows.slice(i, i + BATCH);
      const { error } = await supabase.from('shipments').insert(batch);
      if (error) {
        console.error(`  배치 ${i} 에러:`, error.message);
        // 개별 삽입 시도
        for (const row of batch) {
          const { error: e2 } = await supabase.from('shipments').insert([row]);
          if (!e2) inserted++;
          else console.error(`    행 에러: ${row.ship_date} ${row.client_name} ${row.item_no}: ${e2.message}`);
        }
      } else {
        inserted += batch.length;
      }
      if ((i + BATCH) % 5000 < BATCH) console.log(`  ... ${Math.min(i + BATCH, newRows.length)}/${newRows.length}`);
    }
    console.log(`  shipments 추가 완료: ${inserted}행`);
  }

  // ── Step 4: DL 시트 → glass_shipments 추가 ──
  const dlSheet = mainWb.SheetNames.find(s => /dl/i.test(s)) || mainWb.SheetNames[1];
  console.log(`\n=== Step 4: DL 시트 (${dlSheet}) → glass_shipments ===`);
  {
    const rows = XLSX.utils.sheet_to_json(mainWb.Sheets[dlSheet], { header: 1, defval: '' });
    console.log('  헤더:', rows[0]?.slice(0, 18).join(' | '));

    const newRows = [];
    let skipped = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const shipDate = parseDate(r[1]) || parseDate(r[0]);
      const clientName = toStr(r[16]) || toStr(r[2]);
      const itemNo = toCode(r[4]);
      const itemName = toStr(r[5]);
      const qty = toNum(r[7]) ?? 0;

      if (!shipDate || !itemNo) continue;

      const key = makeKey(shipDate, clientName, itemNo, qty);
      if (dlKeys.has(key)) { skipped++; continue; }
      dlKeys.add(key);

      const clientCode = dlNameToCode.get(clientName) || null;
      newRows.push({
        client_name: clientName,
        client_code: clientCode,
        ship_date: shipDate,
        item_no: itemNo,
        item_name: itemName,
        quantity: qty,
        unit_price: toNum(r[8]),
        selling_price: toNum(r[9]),
        supply_amount: toNum(r[10]),
        manager: toStr(r[3]) || null,
      });
    }
    console.log(`  파싱: ${rows.length - 1}행, 중복 스킵: ${skipped}, 신규: ${newRows.length}`);

    let inserted = 0;
    const BATCH = 500;
    for (let i = 0; i < newRows.length; i += BATCH) {
      const batch = newRows.slice(i, i + BATCH);
      const { error } = await supabase.from('glass_shipments').insert(batch);
      if (error) {
        console.error(`  배치 ${i} 에러:`, error.message);
        for (const row of batch) {
          const { error: e2 } = await supabase.from('glass_shipments').insert([row]);
          if (!e2) inserted++;
          else console.error(`    행 에러: ${row.ship_date} ${row.client_name} ${row.item_no}: ${e2.message}`);
        }
      } else {
        inserted += batch.length;
      }
      if ((i + BATCH) % 5000 < BATCH) console.log(`  ... ${Math.min(i + BATCH, newRows.length)}/${newRows.length}`);
    }
    console.log(`  glass_shipments 추가 완료: ${inserted}행`);
  }

  // ── Step 5: client_details 재구축 ──
  console.log('\n=== Step 5: client_details 재구축 ===');
  {
    // 기존 client_details에 이미 있는 코드 보존 (manager, business_type 등 있음)
    const { data: existing } = await supabase.from('client_details').select('client_code');
    const existingCodes = new Set((existing || []).map(r => r.client_code));

    // shipments에서 새로운 client_code 추출 (거래처별에서 추가된 것 중 code 있는 것)
    const { data: newClients } = await supabase.rpc('get_new_clients_for_details', {});
    // RPC가 없으므로 직접 쿼리
    const { data: allClients, error: qErr } = await supabase
      .from('shipments')
      .select('client_code, client_name, manager, business_type')
      .not('client_code', 'is', null)
      .neq('client_code', '');

    if (qErr) { console.error('client query err:', qErr.message); }
    else {
      const clientMap = new Map();
      for (const r of allClients) {
        if (!r.client_code || existingCodes.has(r.client_code)) continue;
        if (!clientMap.has(r.client_code)) {
          clientMap.set(r.client_code, {
            client_code: r.client_code,
            client_name: r.client_name,
            manager: r.manager || null,
            business_type: r.business_type || null,
          });
        }
      }
      if (clientMap.size > 0) {
        const rows = [...clientMap.values()];
        let ins = 0;
        for (let i = 0; i < rows.length; i += 500) {
          const b = rows.slice(i, i + 500);
          const { error } = await supabase.from('client_details').insert(b);
          if (error) console.error('client_details err:', error.message);
          else ins += b.length;
        }
        console.log(`  신규 client_details: ${ins}행 (기존 ${existingCodes.size})`);
      } else {
        console.log(`  추가할 신규 client 없음 (기존 ${existingCodes.size})`);
      }
    }
  }

  // ── Step 6: glass_clients 재구축 ──
  console.log('\n=== Step 6: glass_clients 재구축 ===');
  {
    const { data: existing } = await supabase.from('glass_clients').select('client_code');
    const existingCodes = new Set((existing || []).map(r => r.client_code));

    const { data: allClients, error: qErr } = await supabase
      .from('glass_shipments')
      .select('client_code, client_name')
      .not('client_code', 'is', null)
      .neq('client_code', '');

    if (qErr) { console.error('glass client query err:', qErr.message); }
    else {
      const clientMap = new Map();
      for (const r of allClients) {
        if (!r.client_code || existingCodes.has(r.client_code)) continue;
        if (!clientMap.has(r.client_code)) {
          clientMap.set(r.client_code, {
            client_code: r.client_code,
            client_name: r.client_name,
          });
        }
      }
      if (clientMap.size > 0) {
        const rows = [...clientMap.values()];
        let ins = 0;
        for (let i = 0; i < rows.length; i += 500) {
          const b = rows.slice(i, i + 500);
          const { error } = await supabase.from('glass_clients').insert(b);
          if (error) console.error('glass_clients err:', error.message);
          else ins += b.length;
        }
        console.log(`  신규 glass_clients: ${ins}행 (기존 ${existingCodes.size})`);
      } else {
        console.log(`  추가할 신규 glass client 없음 (기존 ${existingCodes.size})`);
      }
    }
  }

  // ── 최종 카운트 ──
  console.log('\n=== 최종 결과 ===');
  const { data: counts } = await supabase.rpc('exec_sql', { sql: '' }).catch(() => ({ data: null }));
  // 직접 카운트
  const { count: s1 } = await supabase.from('shipments').select('*', { count: 'exact', head: true });
  const { count: s2 } = await supabase.from('glass_shipments').select('*', { count: 'exact', head: true });
  const { count: s3 } = await supabase.from('client_details').select('*', { count: 'exact', head: true });
  const { count: s4 } = await supabase.from('glass_clients').select('*', { count: 'exact', head: true });
  console.log(`shipments: ${s1}`);
  console.log(`glass_shipments: ${s2}`);
  console.log(`client_details: ${s3}`);
  console.log(`glass_clients: ${s4}`);
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
