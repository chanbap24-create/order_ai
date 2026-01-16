const Database = require('better-sqlite3');
const db = new Database('data.sqlite3', { readonly: true });

console.log('📊 데이터베이스 테이블 목록:');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
tables.forEach(t => console.log(`  - ${t.name}`));

console.log('\n🔍 item_alias 테이블 확인:');
try {
  const aliases = db.prepare(`
    SELECT alias, canonical, count, last_used_at, created_at 
    FROM item_alias 
    ORDER BY count DESC, created_at DESC 
    LIMIT 50
  `).all();
  
  if (aliases.length === 0) {
    console.log('  ❌ 학습된 별칭이 없습니다.');
  } else {
    console.log(`  ✅ 총 ${aliases.length}개 발견\n`);
    
    aliases.forEach((row, idx) => {
      console.log(`${idx + 1}. "${row.alias}" → "${row.canonical}"`);
      console.log(`   사용횟수: ${row.count || 1}회`);
      if (row.last_used_at) console.log(`   최근사용: ${row.last_used_at}`);
      if (row.created_at) console.log(`   생성일시: ${row.created_at}`);
      console.log('');
    });
  }
} catch (err) {
  console.log(`  ⚠️ item_alias 테이블 없음: ${err.message}`);
}

db.close();
