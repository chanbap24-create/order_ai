const Database = require('better-sqlite3');
const db = new Database('data.sqlite3', { readonly: true });

console.log('📊 데이터베이스 테이블 목록:\n');

const tables = db.prepare(`
  SELECT name, type 
  FROM sqlite_master 
  WHERE type='table' 
  ORDER BY name
`).all();

console.log(`총 ${tables.length}개 테이블:\n`);
tables.forEach(t => {
  console.log(`  - ${t.name}`);
});

// 각 테이블의 레코드 수 확인
console.log('\n\n📈 테이블별 레코드 수:');
tables.forEach(t => {
  try {
    const count = db.prepare(`SELECT COUNT(*) as cnt FROM ${t.name}`).get();
    console.log(`  ${t.name}: ${count.cnt}건`);
  } catch (err) {
    console.log(`  ${t.name}: 오류`);
  }
});

db.close();
