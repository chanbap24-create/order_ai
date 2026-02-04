const Database = require('better-sqlite3');
const db = new Database('./data.sqlite3', { readonly: true });

console.log('=== client_item_stats 테이블 구조 ===\n');
const schema = db.prepare(`PRAGMA table_info(client_item_stats)`).all();
schema.forEach(col => {
  console.log(`- ${col.name}: ${col.type}`);
});

console.log('\n=== 샘플 데이터 (client_code=30694) ===');
const sample = db.prepare(`SELECT * FROM client_item_stats WHERE client_code = '30694' LIMIT 5`).all();
console.log(JSON.stringify(sample, null, 2));

db.close();
