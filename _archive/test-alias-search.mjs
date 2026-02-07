import Database from 'better-sqlite3';

const db = new Database('./data.sqlite3');

console.log('🧪 약어 검색 테스트\n');

// 테스트할 약어들
const testCases = [
  { alias: 'va', expected: '뵈브 암발' },
  { alias: 'ch', expected: '찰스 하이직' },
  { alias: 'lc', expected: '레이크 찰리스' },
  { alias: 'rf', expected: '라피니' },
  { alias: 'rb', expected: '로저 벨랑' }
];

console.log('저장된 약어 확인:');
testCases.forEach(({ alias, expected }) => {
  const result = db.prepare(
    'SELECT * FROM item_alias WHERE alias = ?'
  ).get(alias);
  
  if (result) {
    console.log(`✅ ${alias} → ${result.canonical} (예상: ${expected})`);
  } else {
    console.log(`❌ ${alias} → 없음 (예상: ${expected})`);
  }
});

db.close();
