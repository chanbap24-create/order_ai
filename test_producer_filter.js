const fs = require('fs');
const path = require('path');

// 정규화 함수들
function normTight(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[().,\-_/]/g, '');
}

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[().,\-_/]/g, ' ')
    .trim();
}

// 생산자 감지
function detectProducer(rawName) {
  const producers = [
    '크루 와이너리', 'cru winery',
    '루이미셸', 'louis michel',
    '리아타', 'liata',
  ];
  
  const normName = normalize(rawName);
  const tokens = normName.split(/\s+/);
  
  // 긴 매칭 우선
  for (const p of producers) {
    const normP = normalize(p);
    if (normName.includes(normP)) {
      return { hasProducer: true, producer: p };
    }
  }
  
  // 첫 토큰 매칭
  const firstToken = tokens[0];
  for (const p of producers) {
    if (normalize(p).startsWith(firstToken)) {
      return { hasProducer: true, producer: p };
    }
  }
  
  return { hasProducer: false, producer: '' };
}

console.log('\n===== 생산자 감지 및 필터링 테스트 =====\n');

// 테스트 품목 목록
const items = [
  { item_no: '2418531', item_name: '크루 와이너리 피노누아 몬테레이' },
  { item_no: '2421505', item_name: '크루 와이너리 피노누아 산타 루치아 하이랜즈 몬테레이' },
  { item_no: '3420501', item_name: '크루 와이너리 샤르도네 산타 루치아 하이랜즈 몬테레이' },
  { item_no: '3122001', item_name: 'VP 플피이야 프렐리우스 베르멘티노' },
  { item_no: '3422004', item_name: '리아타 소노마 코스트 샤르도네' },
  { item_no: '2118042', item_name: '카시나 아델라이데 바롤로' },
  { item_no: '3023039', item_name: '루이 미셸 애띠, 샤블리' },
];

// 테스트 쿼리
const query = '크루 와이너리 산타루치아 몬테레이';

console.log(`🔍 검색어: "${query}"\n`);

// 1. 생산자 감지
const { hasProducer, producer } = detectProducer(query);
console.log(`1️⃣ 생산자 감지`);
console.log(`   결과: ${hasProducer ? '✅ 감지됨' : '❌ 없음'}`);
if (hasProducer) {
  console.log(`   생산자: "${producer}"\n`);
} else {
  console.log('');
}

// 2. 필터링 전
console.log(`2️⃣ 필터링 전 후보: ${items.length}개`);
items.forEach(item => {
  console.log(`   ${item.item_no}: ${item.item_name}`);
});
console.log('');

// 3. 생산자 필터링
let filtered = items;
if (hasProducer && producer) {
  const producerNorm = normTight(producer);
  console.log(`3️⃣ 생산자 필터링 (정규화: "${producerNorm}")`);
  
  filtered = items.filter(item => {
    const itemNameNorm = normTight(item.item_name);
    const matches = itemNameNorm.includes(producerNorm);
    
    console.log(`   ${matches ? '✅' : '❌'} ${item.item_no}: ${item.item_name}`);
    console.log(`      정규화: "${itemNameNorm}"`);
    console.log(`      매칭: ${itemNameNorm.includes(producerNorm) ? 'O' : 'X'}`);
    
    return matches;
  });
  
  console.log(`\n   필터링 결과: ${items.length}개 → ${filtered.length}개\n`);
}

// 4. 최종 후보
console.log(`4️⃣ 최종 후보: ${filtered.length}개`);
filtered.forEach((item, i) => {
  console.log(`   ${i + 1}. ${item.item_no}: ${item.item_name}`);
});
console.log('');

// 5. 문제점 확인
console.log(`5️⃣ 문제점 확인`);
const wrongItems = items.filter(item => {
  const itemNameNorm = normTight(item.item_name);
  const producerNorm = normTight(producer);
  return !itemNameNorm.includes(producerNorm);
});

console.log(`   "크루 와이너리"가 아닌 품목이 ${wrongItems.length}개 필터링됨:`);
wrongItems.forEach(item => {
  console.log(`   ❌ ${item.item_no}: ${item.item_name}`);
});

if (filtered.length === items.length) {
  console.log(`\n   ⚠️  필터링이 작동하지 않았습니다!`);
} else {
  console.log(`\n   ✅ 필터링이 정상 작동했습니다!`);
}

console.log('\n✅ 테스트 완료!\n');
