const Database = require('better-sqlite3');
const db = new Database('./data.sqlite3', { readonly: true });

console.log('=== 마스터 테이블에서 "크루 와이너리" 검색 ===\n');

// English 시트 확인
const masterTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%master%' OR name LIKE '%english%' OR name LIKE '%item%'`).all();

console.log('사용 가능한 테이블:', masterTable.map(t => t.name).join(', '));

// 실제 마스터 테이블 찾기
let tableName = null;
const candidates = ['master_items', 'items', 'item_english', 'English'];
for (const name of candidates) {
  try {
    const result = db.prepare(`SELECT COUNT(*) as cnt FROM ${name}`).get();
    if (result.cnt > 0) {
      tableName = name;
      console.log(`\n✅ 마스터 테이블 발견: ${name} (${result.cnt}개 품목)`);
      break;
    }
  } catch (e) {
    // 테이블 없음
  }
}

if (!tableName) {
  console.log('❌ 마스터 테이블을 찾을 수 없습니다!');
  process.exit(1);
}

// "크루 와이너리" 검색
console.log('\n=== "크루 와이너리" 검색 결과 ===\n');
const query = `SELECT * FROM ${tableName} WHERE item_name LIKE '%크루%' OR item_name LIKE '%cru%' OR name_en LIKE '%cru%' LIMIT 20`;

try {
  const rows = db.prepare(query).all();
  console.log(`총 ${rows.length}개 발견\n`);
  
  rows.forEach((row, idx) => {
    const itemNo = row.item_no || row.item_code || row.sku || '?';
    const itemName = row.item_name || row.name || row.name_kr || '?';
    const nameEn = row.name_en || row.english_name || '';
    
    console.log(`${idx + 1}. ${itemNo}`);
    console.log(`   한글: ${itemName}`);
    if (nameEn) console.log(`   영문: ${nameEn}`);
    console.log('');
  });
  
  // 2418531 품목 확인
  console.log('\n=== 품번 2418531 확인 ===\n');
  const target = db.prepare(`SELECT * FROM ${tableName} WHERE item_no = '2418531' OR item_no = 2418531`).get();
  if (target) {
    console.log('✅ 발견!');
    console.log(JSON.stringify(target, null, 2));
  } else {
    console.log('❌ 품번 2418531이 마스터 테이블에 없습니다!');
  }
  
} catch (e) {
  console.error('검색 실패:', e.message);
}

db.close();
