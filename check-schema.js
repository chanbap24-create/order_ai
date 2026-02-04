const Database = require('better-sqlite3');
const db = new Database('./data.sqlite3');

console.log('📊 Items 테이블 스키마:');
const schema = db.prepare("PRAGMA table_info(items)").all();
schema.forEach(col => {
  console.log(`  - ${col.name} (${col.type})`);
});

console.log('\n📊 Client_item_stats 테이블 스키마:');
const clientSchema = db.prepare("PRAGMA table_info(client_item_stats)").all();
clientSchema.forEach(col => {
  console.log(`  - ${col.name} (${col.type})`);
});

db.close();
