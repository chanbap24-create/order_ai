const Database = require('better-sqlite3');
const db = new Database('data.sqlite3', { readonly: true });

// 별칭 캐시 로드
function loadAliasCache() {
  const aliases = db.prepare(`
    SELECT alias, canonical
    FROM item_alias
    ORDER BY count DESC
  `).all();
  
  const cache = new Map();
  aliases.forEach(a => {
    cache.set(a.alias.toLowerCase(), a.canonical);
  });
  
  return cache;
}

// 별칭 확장 함수 (실제 코드와 동일)
function expandAliases(text) {
  const aliases = loadAliasCache();
  let expanded = text;
  
  console.log('\n='.repeat(60));
  console.log('📝 원본 입력:', text);
  console.log('='.repeat(60));
  
  // 1. 정확한 단어 매칭
  const words = text.split(/(\s+|[,()\/\-])/);
  console.log('\n1️⃣ 단어 분리:', words);
  
  const expandedWords = words.map(word => {
    const lowerWord = word.toLowerCase();
    if (aliases.has(lowerWord)) {
      console.log(`   ✅ "${word}" → "${aliases.get(lowerWord)}"`);
      return aliases.get(lowerWord);
    }
    return word;
  });
  
  expanded = expandedWords.join('');
  console.log('\n1️⃣ 단계 결과:', expanded);
  
  // 2. 부분 매칭 (공백 무시)
  const sortedAliases = Array.from(aliases.entries())
    .filter(([alias]) => alias.length >= 3)
    .sort((a, b) => b[0].length - a[0].length)
    .slice(0, 100);
  
  const lowerExpanded = expanded.toLowerCase();
  const normalizedExpanded = lowerExpanded.replace(/\s+/g, '');
  
  console.log('\n2️⃣ 부분 매칭 검사:');
  let matchCount = 0;
  
  for (const [alias, canonical] of sortedAliases) {
    const normalizedAlias = alias.replace(/\s+/g, '');
    
    if (normalizedExpanded.includes(normalizedAlias)) {
      console.log(`   ✅ "${alias}" → "${canonical}" (공백무시)`);
      const regex = new RegExp(alias.replace(/\s+/g, '\\s*'), 'gi');
      expanded = expanded.replace(regex, ` ${canonical} `);
      matchCount++;
    } else if (lowerExpanded.includes(alias)) {
      console.log(`   ✅ "${alias}" → "${canonical}" (정확매칭)`);
      const regex = new RegExp(alias, 'gi');
      expanded = expanded.replace(regex, ` ${canonical} `);
      matchCount++;
    }
  }
  
  if (matchCount === 0) {
    console.log('   ❌ 매칭된 별칭 없음');
  }
  
  // 3. 공백 정리
  expanded = expanded.replace(/\s+/g, ' ').trim();
  
  console.log('\n✨ 최종 결과:', expanded);
  console.log('='.repeat(60));
  
  return expanded;
}

// 테스트 케이스
const testCases = [
  '뱅상 지라르댕 포마르 비에유비뉴',
  'vg 포마르 비에유비뉴',
  '클레멍라발레 샤블리 2',
  'cl 샤블리 2',
  '로버트 오들리 시라즈',
  'ro 시라즈 6',
  '찰스하이직 브뤼',
  'ch 브뤼 레제르브'
];

testCases.forEach(test => {
  expandAliases(test);
});

db.close();
