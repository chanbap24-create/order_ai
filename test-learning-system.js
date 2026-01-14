/**
 * ========================================
 * 학습 시스템 테스트 스크립트
 * ========================================
 * 
 * 자연어 전처리 + 토큰 매칭 + 별칭 확장 테스트
 */

const { preprocessNaturalLanguage, preprocessWithDebug } = require('./app/lib/naturalLanguagePreprocessor');
const { tokenBasedSearch, calculateTokenBoost } = require('./app/lib/tokenBasedMatcher');
const Database = require('better-sqlite3');

const db = new Database('data.sqlite3', { readonly: true });

console.log('=== 🧪 학습 시스템 테스트 ===\n');

// 테스트 케이스
const testCases = [
  {
    name: '약어 테스트',
    inputs: [
      'ch 브륏 6병',
      'va 블랑드블랑',
      'rf 클래식',
    ]
  },
  {
    name: '한글 수량 표현',
    inputs: [
      '샤르도네 세병',
      '피노누아 두병 주세요',
      '메를로 다섯병',
    ]
  },
  {
    name: '와인 용어 약어',
    inputs: [
      '샤도 6병',
      '까베 3병',
      '소비 2병',
    ]
  },
  {
    name: '복합 표현',
    inputs: [
      '안녕하세요 ch 브륏 세병 부탁드립니다',
      '샤도 6병이랑 까베 3병 주세요 감사합니다',
    ]
  },
];

// 1. 자연어 전처리 테스트
console.log('📝 1. 자연어 전처리 테스트\n');
testCases.forEach(testCase => {
  console.log(`\n▶ ${testCase.name}`);
  console.log('─'.repeat(60));
  
  testCase.inputs.forEach(input => {
    const result = preprocessWithDebug(input);
    console.log(`입력: "${result.original}"`);
    console.log(`결과: "${result.processed}"`);
    console.log('단계별:');
    result.steps.slice(1).forEach(step => {
      console.log(`  ${step.step}: "${step.result}"`);
    });
    console.log('');
  });
});

// 2. 토큰 기반 검색 테스트
console.log('\n🔍 2. 토큰 기반 검색 테스트\n');
const searchQueries = [
  '찰스 하이직 브륏',
  '라피니 클래식',
  '뵈브 암발 블랑드블랑',
  '샤르도네',
];

searchQueries.forEach(query => {
  console.log(`\n▶ 검색어: "${query}"`);
  console.log('─'.repeat(60));
  
  const results = tokenBasedSearch(query);
  
  if (results.length === 0) {
    console.log('  매칭 결과 없음');
  } else {
    results.slice(0, 5).forEach((r, idx) => {
      console.log(`  ${idx + 1}. ${r.item_no}`);
      console.log(`     매칭 토큰: ${r.matchedTokens.join(', ')}`);
      console.log(`     점수: ${r.totalScore.toFixed(2)}, 학습 빈도: ${r.avgLearnedCount.toFixed(1)}`);
    });
  }
});

// 3. 별칭 확장 테스트
console.log('\n\n🔤 3. 별칭 확장 테스트\n');
const aliasQueries = [
  'ch',
  'va',
  'rf',
  'vg',
  'ro',
];

aliasQueries.forEach(alias => {
  const result = db.prepare(`
    SELECT alias, canonical, count
    FROM item_alias
    WHERE alias = ? COLLATE NOCASE
  `).get(alias);
  
  if (result) {
    console.log(`  ${alias} → ${result.canonical} (사용: ${result.count}회)`);
  } else {
    console.log(`  ${alias} → (매칭 없음)`);
  }
});

// 4. 통합 테스트 (전처리 + 토큰 검색)
console.log('\n\n🚀 4. 통합 테스트 (전처리 + 토큰 검색)\n');
const integrationTests = [
  'ch 브륏 6병',
  '샤도 3병 주세요',
  '안녕하세요 va 블랑드블랑 부탁드립니다',
];

integrationTests.forEach(input => {
  console.log(`\n▶ 입력: "${input}"`);
  console.log('─'.repeat(60));
  
  // 1) 전처리
  const preprocessed = preprocessNaturalLanguage(input);
  console.log(`  전처리: "${preprocessed}"`);
  
  // 2) 토큰 검색
  const results = tokenBasedSearch(preprocessed);
  
  if (results.length > 0) {
    console.log(`  \n  검색 결과 (상위 3개):`);
    results.slice(0, 3).forEach((r, idx) => {
      // 품목명 조회
      const itemName = db.prepare(`
        SELECT name_en
        FROM item_english
        WHERE item_no = ?
      `).get(r.item_no);
      
      console.log(`    ${idx + 1}. ${r.item_no}: ${itemName ? itemName.name_en : '(품목명 없음)'}`);
      console.log(`       매칭: ${r.matchedTokens.join(', ')} | 점수: ${r.totalScore.toFixed(2)}`);
    });
  } else {
    console.log(`  검색 결과 없음`);
  }
});

// 5. 통계 요약
console.log('\n\n📊 5. 학습 데이터 통계\n');

const tokenCount = db.prepare('SELECT COUNT(*) as cnt FROM token_mapping').get();
console.log(`  토큰 매핑: ${tokenCount.cnt}개`);

const aliasCount = db.prepare('SELECT COUNT(*) as cnt FROM item_alias').get();
console.log(`  품목 별칭: ${aliasCount.cnt}개`);

const topAliases = db.prepare(`
  SELECT alias, canonical, count
  FROM item_alias
  WHERE length(alias) <= 3
  ORDER BY count DESC
  LIMIT 10
`).all();

console.log('\n  인기 별칭 TOP 10:');
topAliases.forEach((a, idx) => {
  console.log(`    ${idx + 1}. ${a.alias} → ${a.canonical} (${a.count}회)`);
});

db.close();

console.log('\n\n✅ 테스트 완료!');
