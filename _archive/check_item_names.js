const Database = require('better-sqlite3');
const db = new Database('data.sqlite3', { readonly: true });

console.log('📊 입고 데이터에서 약어 패턴 확인:\n');

// items 테이블에서 약어로 시작하는 품목명 찾기
const tables = ['items', 'Downloads_items', 'item_master'];

for (const table of tables) {
  try {
    const items = db.prepare(`
      SELECT item_no, item_name 
      FROM ${table} 
      WHERE item_name LIKE 'VG %' 
         OR item_name LIKE 'CL %'
         OR item_name LIKE 'RO %'
         OR item_name LIKE 'CH %'
         OR item_name LIKE 'BS %'
      LIMIT 20
    `).all();
    
    if (items.length > 0) {
      console.log(`\n✅ ${table} 테이블 (${items.length}건):`);
      items.forEach(item => {
        console.log(`  ${item.item_no}: ${item.item_name}`);
      });
    }
  } catch (err) {
    // 테이블이 없으면 스킵
  }
}

db.close();
