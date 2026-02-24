// 거래처별제품별입고현황(200101~250731).xlsx → shipments 테이블 임포트
// CDV(와인) + DL(글라스) 시트를 shipments에 추가
// 기존 데이터(2025-08 이후)와 겹치지 않음

const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const FILE = 'sample/거래처별제품별입고현황(200101~250731).xlsx';
const BATCH_SIZE = 500;

// YYYYMMDD number → YYYY-MM-DD string
function parseDate(val) {
  if (!val) return null;
  const s = String(val).trim();
  if (s.length === 8 && /^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  return null;
}

async function importSheet(sheetName, warehouse) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Importing ${sheetName} sheet (warehouse: ${warehouse})`);
  console.log(`${'='.repeat(50)}`);

  const wb = XLSX.readFile(FILE);
  const ws = wb.Sheets[sheetName];
  if (!ws) { console.error(`Sheet '${sheetName}' not found!`); return; }

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const header = rows[0];
  console.log('Header:', header.slice(0, 15));

  // 컬럼 인덱스 매핑
  const colIdx = {};
  const colMap = {
    '판매일자': 'sale_date',
    '출고일자': 'ship_date',
    '거래처명': 'client_name',
    '판매원': 'manager',
    '품목': 'item_no',
    '품목명': 'item_name',
    '용량': 'volume',
    '수량': 'quantity',
    '단가': 'unit_price',
    '금액': 'amount',
    '공급가': 'supply_price',
    '도매장가': 'wholesale_price',
    '할인금액': 'discount',
    '할인율': 'discount_rate',
    '비 고': 'notes',
  };

  header.forEach((h, i) => {
    const key = String(h).trim();
    if (colMap[key]) colIdx[colMap[key]] = i;
  });
  console.log('Mapped columns:', colIdx);

  const dataRows = rows.slice(1); // skip header
  console.log(`Total data rows: ${dataRows.length}`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  let batch = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];

    const shipDate = parseDate(row[colIdx.ship_date]);
    if (!shipDate) { skipped++; continue; }

    const itemNo = String(row[colIdx.item_no] || '').trim();
    if (!itemNo) { skipped++; continue; }

    const clientName = String(row[colIdx.client_name] || '').trim();
    const manager = String(row[colIdx.manager] || '').trim();
    const itemName = String(row[colIdx.item_name] || '').trim();
    const quantity = parseInt(row[colIdx.quantity]) || 0;
    const unitPrice = parseInt(row[colIdx.unit_price]) || 0;
    const amount = parseInt(row[colIdx.amount]) || 0;

    if (quantity === 0) { skipped++; continue; }

    const supplyAmount = amount || (unitPrice * quantity);
    const taxAmount = Math.round(supplyAmount * 0.1);

    batch.push({
      ship_date: shipDate,
      client_name: clientName,
      client_code: null,
      manager: manager,
      item_no: itemNo,
      item_name: itemName,
      unit_price: unitPrice,
      quantity: quantity,
      selling_price: unitPrice,
      supply_amount: supplyAmount,
      tax_amount: taxAmount,
      total_amount: supplyAmount + taxAmount,
      warehouse: warehouse,
      business_type: null,
      department: null,
      shipment_no: null,
      order_type: null,
      sales_type: null,
    });

    if (batch.length >= BATCH_SIZE) {
      const { error } = await sb.from('shipments').insert(batch);
      if (error) {
        console.error(`  Batch error at row ${i}:`, error.message);
        errors += batch.length;
      } else {
        inserted += batch.length;
      }
      batch = [];

      if ((inserted + errors) % 5000 === 0) {
        console.log(`  Progress: ${inserted} inserted, ${skipped} skipped, ${errors} errors (row ${i + 1}/${dataRows.length})`);
      }
    }
  }

  // Flush remaining
  if (batch.length > 0) {
    const { error } = await sb.from('shipments').insert(batch);
    if (error) {
      console.error('  Final batch error:', error.message);
      errors += batch.length;
    } else {
      inserted += batch.length;
    }
  }

  console.log(`\n${sheetName} 완료: ${inserted} inserted, ${skipped} skipped, ${errors} errors`);
  return inserted;
}

async function main() {
  console.log('=== Shipments History Import ===');
  console.log('File:', FILE);

  // 기존 데이터 확인
  const { count } = await sb.from('shipments').select('*', { count: 'exact', head: true });
  console.log(`현재 DB rows: ${count}`);

  const { data: dateRange } = await sb.from('shipments').select('ship_date').order('ship_date', { ascending: true }).limit(1);
  console.log(`현재 최소 날짜: ${dateRange?.[0]?.ship_date}`);

  const cdvCount = await importSheet('CDV', 'CDV');
  const dlCount = await importSheet('DL', 'DL');

  // 최종 확인
  const { count: finalCount } = await sb.from('shipments').select('*', { count: 'exact', head: true });
  console.log(`\n=== 최종 결과 ===`);
  console.log(`DB rows: ${count} → ${finalCount} (+${finalCount - count})`);
}

main().catch(console.error);
