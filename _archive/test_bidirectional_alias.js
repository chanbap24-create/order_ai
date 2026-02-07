const Database = require('better-sqlite3');
const db = new Database('data.sqlite3', { readonly: true });

// 양방향 별칭 캐시 로드
function loadAliasCache() {
  const aliases = db.prepare(`
    SELECT alias, canonical
    FROM item_alias
    ORDER BY count DESC
  `).all();
  
  // 정방향: alias → canonical
  const forward = new Map();
  aliases.forEach(a => {
    forward.set(a.alias.toLowerCase(), a.canonical);
  });
  
  // 역방향: canonical → [alias1, alias2, ...]
  const reverse = new Map();
  aliases.forEach(a => {
    const canonicalLower = a.canonical.toLowerCase();
    if (!reverse.has(canonicalLower)) {
      reverse.set(canonicalLower, []);
    }
    reverse.get(canonicalLower).push(a.alias.toLowerCase());
  });
  
  return { forward, reverse };
}

// 양방향 별칭 확장
function expandAliases(text) {
  const { forward: aliases, reverse: reverseAliases } = loadAliasCache();
  let expanded = text;
  
  console.log('\n' + '='.repeat(70));
  console.log('📝 원본 입력:', text);
  console.log('='.repeat(70));
  
  // 1. 정방향: alias → canonical
  console.log('\n1️⃣ 정방향 매칭 (alias → canonical):');
  const words = text.split(/(\s+|[,()\/\-])/);
  const expandedWords = words.map(word => {
    const lowerWord = word.toLowerCase();
    if (aliases.has(lowerWord)) {
      console.log(`   ✅ "${word}" → "${aliases.get(lowerWord)}"`);
      return aliases.get(lowerWord);
    }
    return word;
  });
  
  expanded = expandedWords.join('');
  console.log('   결과:', expanded);
  
  // 2. 역방향: canonical → alias
  console.log('\n2️⃣ 역방향 매칭 (canonical → alias):');
  const lowerExpanded = expanded.toLowerCase();
  const wordsToAdd = [];
  
  for (const [canonical, aliasesList] of reverseAliases.entries()) {
    const normalizedCanonical = canonical.replace(/\s+/g, '');
    const normalizedExpanded = lowerExpanded.replace(/\s+/g, '');
    
    if (normalizedExpanded.includes(normalizedCanonical) || 
        lowerExpanded.includes(canonical)) {
      const shortestAlias = aliasesList.sort((a, b) => a.length - b.length)[0];
      console.log(`   ✅ "${canonical}" → "+${shortestAlias}"`);
      wordsToAdd.push(shortestAlias);
    }
  }
  
  if (wordsToAdd.length > 0) {
    expanded = expanded + ' ' + wordsToAdd.join(' ');
    console.log('   추가된 약어:', wordsToAdd);
  } else {
    console.log('   ❌ 추가할 약어 없음');
  }
  
  // 3. 공백 정리
  expanded = expanded.replace(/\s+/g, ' ').trim();
  
  console.log('\n✨ 최종 결과:', expanded);
  console.log('='.repeat(70));
  
  return expanded;
}

// 테스트 케이스
console.log('\n🧪 양방향 별칭 확장 테스트\n');

const testCases = [
  // 정방향 테스트 (약어 → 정식명칭)
  'vg 포마르 비에유비뉴',
  'cl 샤블리 2',
  'ro 시라즈 6',
  
  // 역방향 테스트 (정식명칭 → 약어도 추가)
  '뱅상 지라르댕 포마르',
  '클레멍 라발리 샤블리',
  '로버트 오틀리 시라즈',
  '찰스 하이직 브뤼',
  '비온디 산티 브루넬로'
];

testCases.forEach(test => {
  expandAliases(test);
});

db.close();
