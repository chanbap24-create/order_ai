const Database = require('better-sqlite3');
const db = new Database('./cave_de_vin.db');

// 테이블 생성
db.prepare(`
  CREATE TABLE IF NOT EXISTS item_alias (
    alias TEXT PRIMARY KEY,
    canonical TEXT NOT NULL,
    count INTEGER DEFAULT 1,
    last_used_at TEXT DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// 정규화 함수
function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[().,\-_/]/g, ' ')
    .trim();
}

console.log('\n===== 학습 매칭 테스트 =====\n');

// 1. 학습 데이터 추가
console.log('1️⃣ 학습 데이터 추가');
const testData = [
  { alias: '크루 와이너리 산타루치아', canonical: '2421505' },
  { alias: '크루 산타루치아', canonical: '2421505' },
  { alias: '루이미셸 샤블리', canonical: '3023039' },
];

testData.forEach(({ alias, canonical }) => {
  const normalizedAlias = normalize(alias);
  db.prepare(`
    INSERT INTO item_alias (alias, canonical, count, last_used_at, created_at)
    VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(alias) DO UPDATE SET
      count = count + 1,
      last_used_at = CURRENT_TIMESTAMP
  `).run(normalizedAlias, canonical);
  
  console.log(`   ✅ ${alias} → ${canonical} (정규화: ${normalizedAlias})`);
});
console.log('');

// 2. 학습 목록 조회
console.log('2️⃣ 저장된 학습 목록');
const rows = db.prepare(`
  SELECT alias, canonical, count FROM item_alias ORDER BY created_at DESC
`).all();

rows.forEach((row, i) => {
  console.log(`   ${i + 1}. ${row.alias} → ${row.canonical} (${row.count}회)`);
});
console.log('');

// 3. 매칭 테스트
console.log('3️⃣ 학습 매칭 테스트');

function getLearnedMatch(rawInput) {
  const nInputItem = normalize(rawInput);
  
  const aliases = db.prepare(`
    SELECT alias, canonical FROM item_alias ORDER BY length(alias) DESC
  `).all();
  
  // Exact 매칭
  for (const p of aliases) {
    const nAliasItem = normalize(p.alias);
    if (nAliasItem === nInputItem) {
      return { kind: 'exact', canonical: p.canonical };
    }
  }
  
  // Contains 매칭
  for (const p of aliases) {
    const nAliasItem = normalize(p.alias);
    if (nInputItem.includes(nAliasItem)) {
      return { kind: 'contains', canonical: p.canonical };
    }
  }
  
  return null;
}

const testQueries = [
  '크루 와이너리 산타루치아 몬테레이',
  '크루 산타루치아',
  '루이미셸 샤블리',
  '바롤로',
];

testQueries.forEach(query => {
  const result = getLearnedMatch(query);
  console.log(`\n   검색: "${query}"`);
  console.log(`   정규화: "${normalize(query)}"`);
  if (result) {
    console.log(`   ✅ 매칭: ${result.kind} → ${result.canonical}`);
  } else {
    console.log(`   ❌ 매칭 없음`);
  }
});

console.log('\n\n✅ 테스트 완료!\n');
db.close();
