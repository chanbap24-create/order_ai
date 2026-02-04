const message = `거래처명: 배산임수
배송주소: 서울 강남구
연락처: 010-1234-5678

발주 내용
클레멍 라발레 샤블리 2병`;

fetch('http://localhost:8080/api/parse-full-order', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message })
})
.then(res => res.json())
.then(data => {
  const item = data.parsed_items?.find(i => i.name?.includes('클레멍') || i.name?.includes('샤블리'));
  
  if (!item) {
    console.log('❌ 품목을 찾을 수 없습니다');
    return;
  }
  
  console.log('\n=== API 응답 분석 ===');
  console.log('총 suggestions:', item.suggestions?.length);
  console.log('\n정렬 순서 (API 응답):');
  
  item.suggestions?.forEach((s, i) => {
    const tag = s.is_new_item === false ? '✅ 기존' : '🆕 신규';
    console.log(`${i+1}. ${tag} ${s.item_no} - ${s.item_name.substring(0, 30)} (score: ${s.score?.toFixed(3)}, is_new_item: ${s.is_new_item})`);
  });
  
  // 기존 품목이 위에 있는지 확인
  const firstItem = item.suggestions?.[0];
  const secondItem = item.suggestions?.[1];
  
  console.log('\n=== 정렬 검증 ===');
  if (firstItem?.is_new_item === false) {
    console.log('✅ 1번이 기존 품목입니다!');
  } else {
    console.log('❌ 1번이 신규 품목입니다! (문제!)');
  }
  
  if (secondItem?.is_new_item === false) {
    console.log('✅ 2번이 기존 품목입니다!');
  } else {
    console.log('❌ 2번이 신규 품목입니다! (문제!)');
  }
})
.catch(err => console.error('Error:', err));
