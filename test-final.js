const clientMessage = `거래처명: 배산임수
배송주소: 서울 강남구
연락처: 010-1234-5678

발주 내용
클레멍 라발레 샤블리 2병
`;

fetch('http://localhost:3006/api/parse-full-order', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: clientMessage })
})
.then(res => res.json())
.then(data => {
  console.log('\n========== 🔍 전체 응답 ==========');
  console.log('Status:', data.status);
  console.log('Needs review:', data.needs_review_items?.length || 0);
  
  // parsed_items 확인
  const items = data.parsed_items || [];
  console.log('\n총 parsed_items:', items.length);
  
  items.forEach((item, idx) => {
    console.log(`\n=== 품목 ${idx + 1}: ${item.name || item.raw} ===`);
    console.log('Resolved:', item.resolved);
    console.log('Suggestions 개수:', item.suggestions?.length || 0, '개');
    
    if (item.suggestions && item.suggestions.length > 0) {
      console.log('\n후보 목록:');
      item.suggestions.forEach((s, i) => {
        const tag = s.is_new_item === false ? '✅ 기존' : '🆕 신규';
        console.log(`  ${i+1}. ${tag} ${s.item_no} - ${s.item_name} (${s.score?.toFixed(3)})`);
      });
    }
  });
})
.catch(err => console.error('❌ Error:', err));
