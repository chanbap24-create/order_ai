const Database = require('better-sqlite3');
const db = new Database('./cave_de_vin.db');

// 테이블 생성 및 마이그레이션
db.prepare(`
  CREATE TABLE IF NOT EXISTS item_alias (
    alias TEXT PRIMARY KEY,
    canonical TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`).run();

try {
  db.prepare(`ALTER TABLE item_alias ADD COLUMN count INTEGER DEFAULT 1`).run();
} catch {}

try {
  db.prepare(`ALTER TABLE item_alias ADD COLUMN last_used_at TEXT DEFAULT CURRENT_TIMESTAMP`).run();
} catch {}

console.log('\n===== 학습 테스트 =====\n');

// 1. 학습 데이터 추가
console.log('1️⃣ 학습 데이터 추가');
const testAlias = '크루 와이너리 산타루치아';
const testCanonical = '2421505';

// 정규화
function normalizeAlias(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/\r/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[()\-_/.,]/g, ' ')
    .trim();
}

const alias = normalizeAlias(testAlias);
console.log(`   입력: ${testAlias}`);
console.log(`   정규화: ${alias}`);
console.log(`   품목번호: ${testCanonical}`);

// 학습 저장
db.prepare(`
  INSERT INTO item_alias (alias, canonical, count, last_used_at, created_at)
  VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT(alias) DO UPDATE SET
    count = count + 1,
    last_used_at = CURRENT_TIMESTAMP
`).run(alias, testCanonical);

console.log('   ✅ 학습 저장 완료\n');

// 2. 학습 목록 조회 (API 응답 시뮬레이션)
console.log('2️⃣ 학습 목록 조회 (list-item-alias API)');
const rows = db.prepare(`
  SELECT alias, canonical, count, last_used_at, created_at 
  FROM item_alias 
  ORDER BY created_at DESC
`).all();

console.log(`   총 ${rows.length}개의 학습 항목:\n`);

rows.forEach((row, i) => {
  console.log(`   ${i + 1}. ${row.alias} → ${row.canonical}`);
  if (row.count > 1) {
    console.log(`      🔥 학습 ${row.count}회`);
  }
  console.log(`      최근 사용: ${row.last_used_at}`);
  console.log('');
});

// 3. 특정 항목 재학습 테스트
console.log('3️⃣ 동일 항목 재학습 테스트');
db.prepare(`
  UPDATE item_alias
  SET count = count + 1, last_used_at = CURRENT_TIMESTAMP
  WHERE alias = ?
`).run(alias);

const updated = db.prepare(`
  SELECT alias, canonical, count, last_used_at
  FROM item_alias
  WHERE alias = ?
`).get(alias);

console.log(`   ${updated.alias} → ${updated.canonical}`);
console.log(`   학습 횟수: ${updated.count}회`);
console.log(`   ✅ 카운트가 증가했습니다!\n`);

// 4. UI 표시 시뮬레이션
console.log('4️⃣ UI 표시 시뮬레이션');
console.log(`   표시: ${updated.alias} → ${updated.canonical} (학습 ${updated.count}회)`);
console.log(`   최근 사용: ${updated.last_used_at}\n`);

db.close();
console.log('✅ 테스트 완료!\n');
