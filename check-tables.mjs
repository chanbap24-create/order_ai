import Database from 'better-sqlite3';

const db = new Database('./data.sqlite3');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('=== 데이터베이스 테이블 목록 ===');
tables.forEach(t => console.log('  -', t.name));

// 품목 마스터 테이블 찾기
const masterCandidates = ['items', 'item_master', 'Downloads_items', 'downloads_items', 'products'];
const masterTable = tables.find(t => masterCandidates.includes(t.name));

if (masterTable) {
  console.log(`\n찾은 마스터 테이블: ${masterTable.name}`);
  
  const cols = db.prepare(`PRAGMA table_info(${masterTable.name})`).all();
  console.log('\n컬럼:');
  cols.forEach(c => console.log(`  - ${c.name} (${c.type})`));
  
  const count = db.prepare(`SELECT COUNT(*) as cnt FROM ${masterTable.name}`).get();
  console.log(`\n총 품목 수: ${count.cnt}개`);
} else {
  console.log('\n⚠️ 품목 마스터 테이블을 찾을 수 없습니다!');
  console.log('가능한 테이블 중에서 품목 데이터를 찾아야 합니다.');
}

db.close();
