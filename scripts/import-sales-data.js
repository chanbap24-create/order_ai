// 매출 데이터 엑셀 → shipments / glass_shipments 직접 임포트
// Usage: node scripts/import-sales-data.js

const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function parseDate(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  // YYYYMMDD format
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
  }
  // Excel serial number
  if (typeof v === 'number' && v > 30000) {
    const d = new Date((v - 25569) * 86400000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  // YYYY-MM-DD or YYYY/MM/DD
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(s)) return s.replace(/\//g, '-');
  return null;
}

function toNum(v) {
  if (v == null) return null;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isFinite(n) ? n : null;
}

function toStr(v) { return String(v ?? '').trim(); }
function toCode(v) { return String(v ?? '').trim().replace(/\.0$/, ''); }

async function importFile(filePath, table, label) {
  console.log(`\n=== ${label} → ${table} ===`);
  console.log(`Reading ${filePath}...`);

  const buf = require('fs').readFileSync(filePath);
  const wb = XLSX.read(buf, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  console.log(`Total rows: ${rows.length} (header + ${rows.length - 1} data)`);

  // Column mapping for raw 매출 데이터:
  // 0:출고일자 1:부서코드 2:부서명 3:판매원 4:납품처코드 5:납품처명
  // 6:업종명 7:주문장번호 8:품번 9:품목명 10:ml 11:구분
  // 12:요청 13:출고 14:비고 15:단가 16:금액 17:판매금액
  // 18:부가세 19:합계금액 20:품목비고 21:창고 22:계산서번호

  const shipments = [];
  const clientMap = new Map(); // code → { name, manager, department, business_type }

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const clientCode = toCode(r[4]);
    const clientName = toStr(r[5]);
    const itemNo = toCode(r[8]);
    const itemName = toStr(r[9]);

    if (!clientCode || !itemNo) continue;

    const shipDate = parseDate(r[0]);
    const manager = toStr(r[3]);
    const department = toStr(r[2]);
    const businessType = toStr(r[6]);

    // Track latest manager/dept per client
    if (!clientMap.has(clientCode) || (shipDate && shipDate > (clientMap.get(clientCode).lastDate || ''))) {
      clientMap.set(clientCode, {
        name: clientName, manager, department, business_type: businessType,
        lastDate: shipDate
      });
    }

    shipments.push({
      client_name: clientName,
      client_code: clientCode,
      ship_date: shipDate,
      item_no: itemNo,
      item_name: itemName,
      quantity: toNum(r[13]) ?? 0,
      unit_price: toNum(r[15]),
      selling_price: toNum(r[16]),
      supply_amount: toNum(r[17]),
      tax_amount: toNum(r[18]),
      total_amount: toNum(r[19]),
      business_type: businessType,
      manager: manager,
      department: department,
      warehouse: toStr(r[21]),
    });
  }

  console.log(`Parsed ${shipments.length} shipment rows, ${clientMap.size} unique clients`);

  // 1. 기존 데이터 유지하고 중복 제외 후 추가 (APPEND 모드)
  // 기존 키 Set 구축
  console.log(`Building dedup keys from existing ${table}...`);
  const existingKeys = new Set();
  let offset = 0;
  const PAGE = 1000;
  while (true) {
    const { data: chunk } = await supabase.from(table)
      .select('ship_date, client_name, item_no, quantity')
      .range(offset, offset + PAGE - 1);
    if (!chunk || chunk.length === 0) break;
    for (const r of chunk) {
      existingKeys.add(`${r.ship_date}|${r.client_name}|${r.item_no}|${r.quantity}`);
    }
    offset += chunk.length;
    if (chunk.length < PAGE) break;
  }
  console.log(`  existing keys: ${existingKeys.size}`);

  // 중복 제거
  const newShipments = shipments.filter(r => {
    const key = `${r.ship_date}|${r.client_name}|${r.item_no}|${r.quantity}`;
    if (existingKeys.has(key)) return false;
    existingKeys.add(key);
    return true;
  });
  console.log(`  new rows to insert: ${newShipments.length} (skipped ${shipments.length - newShipments.length} dupes)`);

  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < newShipments.length; i += BATCH) {
    const batch = newShipments.slice(i, i + BATCH);
    const { error } = await supabase.from(table).insert(batch);
    if (error) {
      console.error(`Insert error at batch ${i}:`, error.message);
      // Try smaller batches
      for (const row of batch) {
        const { error: e2 } = await supabase.from(table).insert([row]);
        if (e2) console.error(`  Row error: ${row.client_code} ${row.item_no} ${row.ship_date}: ${e2.message}`);
        else inserted++;
      }
    } else {
      inserted += batch.length;
    }
    if ((i + BATCH) % 10000 < BATCH) {
      console.log(`  ... ${Math.min(i + BATCH, newShipments.length)}/${newShipments.length} inserted`);
    }
  }
  console.log(`Inserted ${inserted} new rows into ${table} (total now: ${existingKeys.size})`);

  // 2. Append new clients to client_details (기존 유지, 신규만 추가)
  const detailsTable = table === 'glass_shipments' ? 'glass_clients' : 'client_details';
  console.log(`Updating ${detailsTable} (append mode)...`);
  const { data: existingClients } = await supabase.from(detailsTable).select('client_code');
  const existingClientCodes = new Set((existingClients || []).map(r => r.client_code));

  const details = [];
  for (const [code, info] of clientMap) {
    if (existingClientCodes.has(code)) continue;
    const row = { client_code: code, client_name: info.name };
    if (detailsTable === 'client_details') {
      row.manager = info.manager;
      row.business_type = info.business_type;
    }
    details.push(row);
  }

  let detailInserted = 0;
  for (let i = 0; i < details.length; i += BATCH) {
    const batch = details.slice(i, i + BATCH);
    const { error } = await supabase.from(detailsTable).insert(batch);
    if (error) console.error(`client_details insert error:`, error.message);
    else detailInserted += batch.length;
  }
  console.log(`Inserted ${detailInserted} new rows into ${detailsTable} (existing: ${existingClientCodes.size})`);

  return { shipments: inserted, clients: detailInserted };
}

async function main() {
  console.log('매출 데이터 임포트 시작...');

  const cdvResult = await importFile(
    'sample/매출 데이터(20년 부터)-cdv.xlsx',
    'shipments',
    'CDV (Wine)'
  );

  const dlResult = await importFile(
    'sample/매출 데이터(20년 부터)-DL.xlsx',
    'glass_shipments',
    'DL (Glass)'
  );

  console.log('\n=== 완료 ===');
  console.log(`CDV: shipments=${cdvResult.shipments}, clients=${cdvResult.clients}`);
  console.log(`DL: shipments=${dlResult.shipments}, clients=${dlResult.clients}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
