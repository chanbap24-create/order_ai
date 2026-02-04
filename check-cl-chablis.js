const Database = require('better-sqlite3');
const db = new Database('./data.sqlite3', { readonly: true });

console.log('=== 배산임수(30694) CL 샤블리 관련 확인 ===\n');

// 1. client_item_stats에서 CL 관련 품목
console.log('1. client_item_stats에서 CL 관련:');
const clInHistory = db.prepare(`
  SELECT item_no, item_name 
  FROM client_item_stats 
  WHERE client_code = '30694' 
    AND (item_name LIKE '%CL%' OR item_name LIKE '%클레%' OR item_name LIKE '%샤블리%')
  ORDER BY item_no
`).all();

console.log(`총 ${clInHistory.length}개:`);
clInHistory.forEach(item => {
  console.log(`  - ${item.item_no}: ${item.item_name}`);
});

// 2. items 테이블에서 CL 샤블리 품목
console.log('\n2. items 테이블에서 CL 샤블리:');
const clInMaster = db.prepare(`
  SELECT item_no, item_name 
  FROM items 
  WHERE item_name LIKE '%CL%샤블리%'
  ORDER BY item_no
  LIMIT 10
`).all();

console.log(`총 ${clInMaster.length}개:`);
clInMaster.forEach(item => {
  const inHistory = clInHistory.find(h => h.item_no === item.item_no);
  console.log(`  - ${item.item_no}: ${item.item_name} ${inHistory ? '✅ 입고이력 있음' : '❌ 입고이력 없음'}`);
});

//  3. 특정 품목 직접 확인
console.log('\n3. 특정 품목 직접 확인:');
['3021049', '3021065', '3022065'].forEach(itemNo => {
  const inMaster = db.prepare(`SELECT item_name FROM items WHERE item_no = ?`).get(itemNo);
  const inHistory = db.prepare(`SELECT item_name FROM client_item_stats WHERE client_code = '30694' AND item_no = ?`).get(itemNo);
  console.log(`  ${itemNo}:`);
  console.log(`    - items: ${inMaster ? inMaster.item_name : '없음'}`);
  console.log(`    - client_item_stats: ${inHistory ? inHistory.item_name + ' ✅' : '없음 ❌'}`);
});

db.close();
