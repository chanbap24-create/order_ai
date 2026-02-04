const Database = require('better-sqlite3');
const db = new Database('./data.sqlite3', { readonly: true });

console.log('=== 배산임수(30694) 거래처 이력 확인 ===\n');

// 전체 개수
const total = db.prepare(`
  SELECT COUNT(*) as count 
  FROM client_item_stats 
  WHERE client_code = '30694'
`).get();
console.log('총 품목 개수:', total.count);

// CL 샤블리 관련 품목
console.log('\n=== CL 샤블리 관련 품목 ===');
const clItems = db.prepare(`
  SELECT item_no, purchase_count 
  FROM client_item_stats 
  WHERE client_code = '30694' 
    AND (item_no LIKE '302%' OR item_no LIKE '30210%')
  ORDER BY item_no
`).all();

console.log('302로 시작하는 품목:', clItems.length, '개');
clItems.forEach(item => {
  console.log(`- ${item.item_no}: ${item.purchase_count}회`);
});

// 3021049, 3022065 확인
console.log('\n=== 특정 품목 확인 ===');
const check1 = db.prepare(`SELECT * FROM client_item_stats WHERE client_code = '30694' AND item_no = '3021049'`).get();
const check2 = db.prepare(`SELECT * FROM client_item_stats WHERE client_code = '30694' AND item_no = '3022065'`).get();
const check3 = db.prepare(`SELECT * FROM client_item_stats WHERE client_code = '30694' AND item_no = '3021065'`).get();

console.log('3021049 (CL 샤블리):', check1 ? `있음 ✅ (${check1.purchase_count}회)` : '없음 ❌');
console.log('3022065 (CL 샤블리 "샹트 메흘르"):', check2 ? `있음 ✅ (${check2.purchase_count}회)` : '없음 ❌');
console.log('3021065 (CL 샤블리 샹트메흘르?):', check3 ? `있음 ✅ (${check3.purchase_count}회)` : '없음 ❌');

// items 테이블에서 이름 확인
console.log('\n=== items 테이블에서 품목명 확인 ===');
const items = db.prepare(`
  SELECT item_no, item_name 
  FROM items 
  WHERE item_no IN ('3021049', '3021065', '3022065', '3022049', '3020701', '3021705')
  ORDER BY item_no
`).all();

items.forEach(item => {
  const inHistory = db.prepare(`SELECT * FROM client_item_stats WHERE client_code = '30694' AND item_no = ?`).get(item.item_no);
  console.log(`${item.item_no} - ${item.item_name}: ${inHistory ? `입고이력 있음 ✅ (${inHistory.purchase_count}회)` : '입고이력 없음 ❌'}`);
});

db.close();
