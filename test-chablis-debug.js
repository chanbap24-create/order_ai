const clientMessage = `거래처명: 배산임수
배송주소: 서울 강남구
연락처: 010-1234-5678

발주 내용
클레멍 라발레 샤블리 2병
`;

fetch('http://localhost:3004/api/parse-full-order', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: clientMessage })
})
.then(res => res.json())
.then(data => {
  console.log('\n========== 🔍 상세 분석 ==========');
  console.log('Status:', data.status);
  console.log('검토 필요 항목:', data.needs_review_items?.length || 0);
  
  const item = data.needs_review_items?.[0];
  if (item) {
    console.log('\n📦 품목:', item.raw_input || item.normalized_query);
    console.log('\n후보 품목 (표시 순서):');
    item.suggestions?.forEach((s, i) => {
      const isExisting = s.is_new_item === false;
      const tag = isExisting ? '✅ 기존' : '🆕 신규';
      console.log(`  ${i+1}. ${tag} ${s.item_no} - ${s.item_name} (${s.score?.toFixed(3)})`);
    });
  }
  
  console.log('\n========== 원본 JSON ==========');
  console.log(JSON.stringify(data, null, 2));
})
.catch(err => console.error('Error:', err));
