const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const wb = XLSX.readFile('sample/2026-02-24_135406.XLSX');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

  // 기존 데이터 삭제 (재실행 대비)
  const { error: delErr } = await supabase.from('payments').delete().neq('id', 0);
  if (delErr) console.error('Delete error:', delErr);

  let currentCode = '', currentName = '', currentManager = '', currentDept = '';
  const rows = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    // 이월 행에서 거래처 정보 갱신
    if (row[4] === '이월' && row[1]) {
      currentCode = String(row[1]);
      currentName = row[2] || '';
      currentDept = row[12] || '';
      currentManager = row[13] || '';
    }

    // 일계 행에서 수금액 추출
    if (row[4] === '일계' && row[8] && Number(row[8]) > 0 && row[3]) {
      rows.push({
        client_code: currentCode,
        client_name: currentName,
        payment_date: row[3],
        amount: Math.round(Number(row[8])),
        manager: currentManager,
        department: currentDept,
      });
    }
  }

  console.log(`Inserting ${rows.length} payment records...`);

  // 배치 삽입 (500개씩)
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase.from('payments').insert(batch);
    if (error) {
      console.error(`Batch ${i} error:`, error);
    } else {
      inserted += batch.length;
      process.stdout.write(`\r  ${inserted}/${rows.length}`);
    }
  }

  console.log(`\nDone! ${inserted} records inserted.`);
}

main().catch(console.error);
