/**
 * ========================================
 * 학습 시스템 간단 테스트
 * ========================================
 */

const Database = require('better-sqlite3');
const db = new Database('data.sqlite3', { readonly: true });

console.log('=== 🧪 학습 데이터 검증 ===\n');

// 1. 토큰 매핑 통계
console.log('📊 1. 토큰 매핑 통계');
console.log('─'.repeat(60));

const tokenCount = db.prepare('SELECT COUNT(*) as cnt FROM token_mapping').get();
console.log(`총 토큰: ${tokenCount.cnt}개\n`);

const tokenTypes = db.prepare(`
  SELECT token_type, COUNT(*) as cnt
  FROM token_mapping
  GROUP BY token_type
  ORDER BY cnt DESC
`).all();

tokenTypes.forEach(t => {
  console.log(`  ${t.token_type}: ${t.cnt}개`);
});

// 2. 품목 별칭 통계
console.log('\n\n📝 2. 품목 별칭 통계');
console.log('─'.repeat(60));

const aliasCount = db.prepare('SELECT COUNT(*) as cnt FROM item_alias').get();
console.log(`총 별칭: ${aliasCount.cnt}개\n`);

const topAliases = db.prepare(`
  SELECT alias, canonical, count
  FROM item_alias
  WHERE length(alias) <= 3
  ORDER BY count DESC
  LIMIT 20
`).all();

console.log('인기 별칭 TOP 20:');
topAliases.forEach((a, idx) => {
  console.log(`  ${idx + 1}. ${a.alias.padEnd(5)} → ${a.canonical.padEnd(30)} (${a.count}회)`);
});

// 3. 특정 품목의 토큰 매핑 조회
console.log('\n\n🔍 3. 특정 품목 토큰 조회 (찰스 하이직)');
console.log('─'.repeat(60));

const charlesTokens = db.prepare(`
  SELECT token, mapped_text, token_type, learned_count
  FROM token_mapping
  WHERE mapped_text LIKE '00NV%'
    AND (token LIKE '%찰스%' OR token LIKE '%하이직%' OR token LIKE '%charles%' OR token LIKE '%heidsieck%')
  ORDER BY learned_count DESC
  LIMIT 10
`).all();

charlesTokens.forEach(t => {
  console.log(`  ${t.token} → ${t.mapped_text} (타입: ${t.token_type}, 빈도: ${t.learned_count})`);
});

// 4. 학습 가능성 테스트 (간단한 매칭)
console.log('\n\n🎯 4. 간단 매칭 테스트');
console.log('─'.repeat(60));

const testQueries = [
  { alias: 'ch', expected: '찰스 하이직' },
  { alias: 'va', expected: '뵈브 암발' },
  { alias: 'rf', expected: '라피니' },
  { alias: 'vg', expected: '뱅상 지라르댕' },
];

testQueries.forEach(test => {
  const result = db.prepare(`
    SELECT canonical, count
    FROM item_alias
    WHERE alias = ? COLLATE NOCASE
  `).get(test.alias);
  
  if (result) {
    const match = result.canonical === test.expected ? '✅' : '⚠️';
    console.log(`  ${match} "${test.alias}" → "${result.canonical}" (예상: "${test.expected}", 사용: ${result.count}회)`);
  } else {
    console.log(`  ❌ "${test.alias}" → 매칭 없음 (예상: "${test.expected}")`);
  }
});

// 5. 토큰으로 품목 역검색
console.log('\n\n🔎 5. 토큰 역검색 테스트');
console.log('─'.repeat(60));

const tokenSearches = [
  '찰스',
  '하이직',
  '브륏',
  '라피니',
];

tokenSearches.forEach(token => {
  const results = db.prepare(`
    SELECT DISTINCT mapped_text, COUNT(*) as match_count
    FROM token_mapping
    WHERE token = ? COLLATE NOCASE
    GROUP BY mapped_text
    ORDER BY match_count DESC
    LIMIT 3
  `).all(token);
  
  if (results.length > 0) {
    console.log(`\n  "${token}" 검색 결과:`);
    results.forEach((r, idx) => {
      // 품목명 조회
      const itemName = db.prepare(`
        SELECT name_en
        FROM item_english
        WHERE item_no = ?
      `).get(r.mapped_text);
      
      console.log(`    ${idx + 1}. ${r.mapped_text}: ${itemName ? itemName.name_en : '(없음)'}`);
    });
  } else {
    console.log(`\n  "${token}": 결과 없음`);
  }
});

db.close();

console.log('\n\n✅ 검증 완료!\n');
