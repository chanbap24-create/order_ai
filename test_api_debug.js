// API 테스트 (fetch 사용)
const query = `몽도
크루 와이너리 산타루치아 몬테레이 3병`;

console.log('\n===== API 디버깅 테스트 =====\n');
console.log('입력:', query);
console.log('\nAPI 호출 중...\n');

fetch('https://order-ai-one.vercel.app/api/parse-full-order', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    message: query,
    force_resolve: true 
  })
})
.then(res => res.json())
.then(json => {
  console.log('=== 응답 받음 ===\n');
  
  const items = json.items || [];
  if (items.length === 0) {
    console.log('❌ 품목 없음\n');
    return;
  }
  
  const item = items[0];
  console.log(`품목: "${item.name}"`);
  console.log(`확정: ${item.resolved ? '✅ Yes' : '❌ No'}`);
  
  if (item.resolved) {
    console.log(`\n확정 품목:`);
    console.log(`  품목번호: ${item.item_no}`);
    console.log(`  품목명: ${item.item_name}`);
    console.log(`  점수: ${item.score}`);
  }
  
  const candidates = item.suggestions || item.candidates || [];
  console.log(`\n후보 ${candidates.length}개:\n`);
  
  candidates.slice(0, 10).forEach((c, i) => {
    const newBadge = c.is_new_item ? '[신규]' : '';
    console.log(`${i + 1}. ${c.item_no} - ${c.item_name.substring(0, 50)} ${newBadge}`);
    console.log(`   점수: ${c.score}`);
    
    // 디버그 정보 확인
    if (c._debug) {
      console.log(`   디버그:`);
      console.log(`     baseScore: ${c._debug.baseScore}`);
      console.log(`     userLearning: ${c._debug.userLearning}`);
      console.log(`     recentPurchase: ${c._debug.recentPurchase}`);
      console.log(`     purchaseFrequency: ${c._debug.purchaseFrequency}`);
      if (c._debug.isInClientHistory !== undefined) {
        console.log(`     거래처 이력: ${c._debug.isInClientHistory ? 'O' : 'X'}`);
      }
    }
    console.log('');
  });
  
  // 크루 와이너리가 아닌 품목 확인
  const wrongItems = candidates.filter(c => 
    !c.item_name.includes('크루') && !c.item_name.includes('Cru')
  );
  
  console.log(`\n⚠️  크루 와이너리가 아닌 품목: ${wrongItems.length}개`);
  wrongItems.forEach(c => {
    console.log(`  ❌ ${c.item_no}: ${c.item_name.substring(0, 40)}`);
  });
  
  if (wrongItems.length > 0) {
    console.log('\n❌ 생산자 필터링이 작동하지 않았습니다!');
  } else {
    console.log('\n✅ 생산자 필터링 정상!');
  }
})
.catch(err => {
  console.error('에러:', err);
});
