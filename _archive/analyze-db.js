const Database = require('better-sqlite3');
const db = new Database('data.sqlite3', { readonly: true });

console.log('=== 테이블 목록 ===');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
tables.forEach(t => console.log(t.name));

console.log('\n=== item_english 테이블 구조 ===');
const itemsSchema = db.prepare('PRAGMA table_info(item_english)').all();
itemsSchema.forEach(col => console.log(`${col.name} (${col.type})`));

console.log('\n=== 품목 수 ===');
const count = db.prepare('SELECT COUNT(*) as cnt FROM item_english').get();
console.log(`Total: ${count.cnt}`);

console.log('\n=== 품목 샘플 (10개) ===');
const samples = db.prepare('SELECT * FROM item_english LIMIT 10').all();
samples.forEach(s => console.log(JSON.stringify(s)));

console.log('\n=== token_mapping 통계 ===');
const tokenCount = db.prepare('SELECT COUNT(*) as cnt FROM token_mapping').get();
console.log(`Total tokens: ${tokenCount.cnt}`);
const tokenSamples = db.prepare('SELECT * FROM token_mapping LIMIT 10').all();
tokenSamples.forEach(t => console.log(JSON.stringify(t)));

console.log('\n=== item_alias 통계 ===');
const aliasCount = db.prepare('SELECT COUNT(*) as cnt FROM item_alias').get();
console.log(`Total aliases: ${aliasCount.cnt}`);
const aliasSamples = db.prepare('SELECT * FROM item_alias LIMIT 10').all();
aliasSamples.forEach(a => console.log(JSON.stringify(a)));

console.log('\n=== client_item_stats 통계 ===');
const statsCount = db.prepare('SELECT COUNT(*) as cnt FROM client_item_stats').get();
console.log(`Total stats: ${statsCount.cnt}`);

console.log('\n=== ml_training_data 통계 ===');
try {
  const mlCount = db.prepare('SELECT COUNT(*) as cnt FROM ml_training_data').get();
  console.log(`Total ML data: ${mlCount.cnt}`);
  const mlSamples = db.prepare('SELECT * FROM ml_training_data LIMIT 3').all();
  mlSamples.forEach(m => console.log(JSON.stringify(m)));
} catch(e) {
  console.log('ml_training_data 에러:', e.message);
}

db.close();
