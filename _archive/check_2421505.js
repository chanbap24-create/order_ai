const XLSX = require('xlsx');
const workbook = XLSX.readFile('./order-ai.xlsx');
const sheet = workbook.Sheets['English'];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

console.log('=== 308행 확인 ===');
const row308 = data[308];
console.log('행 308:', row308);

console.log('\n=== 2421505 검색 ===');
for (let i = 0; i < data.length; i++) {
  const row = data[i];
  if (String(row[1]).includes('2421505') || String(row[2]) === '2421505') {
    console.log(`✅ 발견! 행 ${i}`);
    console.log('품번:', row[1], '/', row[2]);
    console.log('영문명:', row[7]);
    console.log('한글명:', row[8]);
    console.log('전체 행:', row);
    break;
  }
}

// DB에서 확인
console.log('\n=== DB에서 2421505 확인 ===');
const Database = require('better-sqlite3');
const db = new Database('./data.sqlite3', { readonly: true });

// client_item_stats
const clientItem = db.prepare('SELECT * FROM client_item_stats WHERE item_no = ?').all('2421505');
console.log('거래처 이력:', clientItem.length > 0 ? '있음' : '없음');
if (clientItem.length > 0) {
  console.log('샘플:', clientItem[0]);
}

// item_english
const english = db.prepare('SELECT * FROM item_english WHERE item_no = ?').get('2421505');
console.log('영문명 테이블:', english ? '있음' : '없음');
if (english) {
  console.log('영문명:', english.name_en);
}

db.close();
