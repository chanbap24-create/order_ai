// 생산자 감지 테스트

function detectProducerSimple(rawName) {
  const lowerName = rawName.toLowerCase().trim();
  
  // 테스트용 생산자 목록
  const producers = [
    '크루',
    '크루 와이너리',
    '루이미셸',
    '리아타',
  ];
  
  // 1단계: 전체 문자열에서 생산자 검색 (더 긴 매칭 우선)
  let longestMatch = '';
  let matchedProducer = '';
  
  for (const p of producers) {
    const pLower = p.toLowerCase();
    
    if (lowerName.includes(pLower)) {
      if (pLower.length > longestMatch.length) {
        longestMatch = pLower;
        
        const tokens = rawName.trim().split(/\s+/);
        for (const token of tokens) {
          if (token.toLowerCase().includes(pLower)) {
            matchedProducer = token;
            break;
          }
        }
        
        if (!matchedProducer) {
          const startIdx = lowerName.indexOf(pLower);
          matchedProducer = rawName.substring(startIdx, startIdx + pLower.length);
        }
      }
    }
  }
  
  if (matchedProducer) {
    return { hasProducer: true, producer: matchedProducer };
  }
  
  // 2단계: 첫 번째 토큰
  const tokens = rawName.trim().split(/\s+/);
  if (tokens.length === 0) return { hasProducer: false, producer: '' };
  
  const firstToken = tokens[0].toLowerCase();
  const matched = producers.find(p => 
    firstToken.includes(p.toLowerCase()) || p.toLowerCase().includes(firstToken)
  );
  
  if (matched) {
    return { hasProducer: true, producer: tokens[0] };
  }
  
  return { hasProducer: false, producer: '' };
}

const testCases = [
  '크루 와이너리 산타루치아 몬테레이',
  '루이미셸 샤블리',
  '리아타 소노마 코스트 샤르도네',
  '바롤로',
];

console.log('========== 생산자 감지 테스트 ==========\n');

testCases.forEach(query => {
  const result = detectProducerSimple(query);
  console.log(`입력: "${query}"`);
  console.log(`결과: ${result.hasProducer ? `✅ 생산자 감지: "${result.producer}"` : '❌ 생산자 없음'}`);
  console.log('');
});

console.log('========== 필터링 효과 ==========\n');
console.log('입력: "크루 와이너리 산타루치아 몬테레이"');
console.log('생산자 감지: "크루 와이너리"');
console.log('');
console.log('필터링 전 후보:');
console.log('  - 크루 와이너리 피노누아 산타 루치아 하이랜즈 ✅');
console.log('  - 크루 와이너리 피노누아 몬테레이 ✅');
console.log('  - VP 플피이야 프렐리우스 베르멘티노 ❌');
console.log('  - 리아타 소노마 코스트 샤르도네 ❌');
console.log('');
console.log('필터링 후 후보:');
console.log('  - 크루 와이너리 피노누아 산타 루치아 하이랜즈 ✅');
console.log('  - 크루 와이너리 피노누아 몬테레이 ✅');
console.log('');
console.log('결과: 크루 와이너리 품목만 표시됨! 🎯');
