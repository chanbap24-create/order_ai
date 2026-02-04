console.log('🧪 매칭 로직 테스트\n');

// 정규화 함수
function normTight(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, "")
    .replace(/[()\-_/.,]/g, "");
}

const target = '루이 미셸 에피, 샤블리 1er Cru "몬테 드 토네흐"';
const queries = [
  '루이미쉘 Chablis Montee de tonnerre',
  '루이미셸 샤블리 몬테 드 토네흐',
  '루이 미셸 샤블리 몬테',
  'Louis Michel Chablis Montee de tonnerre',
];

console.log('타겟:', target);
console.log('타겟 정규화:', normTight(target));
console.log('');

queries.forEach((q, idx) => {
  const qNorm = normTight(q);
  const tNorm = normTight(target);
  
  console.log(`\n쿼리 ${idx+1}: "${q}"`);
  console.log('정규화:', qNorm);
  
  // 포함 여부 체크
  const isSubstring = tNorm.includes(qNorm);
  const containsQuery = qNorm.split('').every(ch => tNorm.includes(ch));
  
  console.log('정규화 후 포함:', isSubstring ? '✅' : '❌');
  console.log('모든 문자 포함:', containsQuery ? '✅' : '❌');
  
  // 키워드 매칭
  const qWords = q.split(/\s+/);
  const tWords = target.split(/[\s,]+/);
  
  const matched = qWords.filter(qw => {
    return tWords.some(tw => {
      const qwNorm = normTight(qw);
      const twNorm = normTight(tw);
      return twNorm.includes(qwNorm) || qwNorm.includes(twNorm);
    });
  });
  
  console.log(`키워드 매칭: ${matched.length}/${qWords.length}`);
  console.log('매칭된 단어:', matched.join(', '));
});

// 중요: "미쉘" vs "미셸" 차이
console.log('\n\n🔍 중요 발견: "미쉘" vs "미셸" 차이');
console.log('검색어: "미쉘" (ㅅ+ㅠ)');
console.log('DB: "미셸" (ㅅ+ㅔ)');
console.log('일치 여부:', normTight('미쉘') === normTight('미셸'));
console.log('미쉘 정규화:', normTight('미쉘'));
console.log('미셸 정규화:', normTight('미셸'));
