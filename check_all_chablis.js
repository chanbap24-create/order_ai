const Database = require('better-sqlite3');
const db = new Database('data.sqlite3', { readonly: true });

console.log('🔍 샤블리 관련 전체 데이터 확인\n');

const tables = ['items', 'Downloads_items', 'item_master'];

for (const table of tables) {
  try {
    console.log(`\n📊 ${table} 테이블:`);
    
    // 샤블리 검색
    const chablis = db.prepare(`
      SELECT item_no, item_name 
      FROM ${table} 
      WHERE item_name LIKE '%샤블리%' 
         OR item_name LIKE '%chablis%'
      ORDER BY item_name
      LIMIT 20
    `).all();
    
    if (chablis.length > 0) {
      console.log(`   ✅ 총 ${chablis.length}건 발견:\n`);
      chablis.forEach((item, idx) => {
        console.log(`   ${idx + 1}. ${item.item_no}: ${item.item_name}`);
      });
    } else {
      console.log('   ❌ 샤블리 관련 데이터 없음');
    }
  } catch (err) {
    console.log(`   ⚠️ ${table} 테이블 없음`);
  }
}

// "라발리" 키워드로 검색
console.log('\n\n🔍 "라발리" 키워드 검색:');
for (const table of tables) {
  try {
    const items = db.prepare(`
      SELECT item_no, item_name 
      FROM ${table} 
      WHERE item_name LIKE '%라발리%'
      LIMIT 10
    `).all();
    
    if (items.length > 0) {
      console.log(`\n   ${table}:`);
      items.forEach(item => {
        console.log(`      ${item.item_no}: ${item.item_name}`);
      });
    }
  } catch (err) {}
}

db.close();
