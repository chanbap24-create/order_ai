const Database = require('better-sqlite3');
const db = new Database('data.sqlite3', { readonly: true });

console.log('=== token_mapping 통계 ===');
const count = db.prepare('SELECT COUNT(*) as cnt FROM token_mapping').get();
console.log(`총 ${count.cnt}개`);

console.log('\n=== 샘플 10개 ===');
const samples = db.prepare('SELECT * FROM token_mapping LIMIT 10').all();
samples.forEach(s => console.log(JSON.stringify(s)));

console.log('\n=== 토큰 타입별 통계 ===');
const types = db.prepare('SELECT token_type, COUNT(*) as cnt FROM token_mapping GROUP BY token_type ORDER BY cnt DESC').all();
types.forEach(t => console.log(`${t.token_type}: ${t.cnt}개`));

console.log('\n=== item_alias 통계 ===');
const aliasCount = db.prepare('SELECT COUNT(*) as cnt FROM item_alias').get();
console.log(`총 ${aliasCount.cnt}개`);

console.log('\n=== 인기 별칭 TOP 20 (영문 약어) ===');
const aliases = db.prepare("SELECT * FROM item_alias WHERE length(alias) <= 3 ORDER BY count DESC LIMIT 20").all();
aliases.forEach(a => console.log(`${a.alias} -> ${a.canonical} (사용: ${a.count}회)`));

db.close();
