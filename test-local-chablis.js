const testMessage = `거래처: 배산임수 (30694)
발주 내용: 클레멍 라발레 샤블리 2병`;

console.log('테스트 요청:', testMessage);

fetch('http://localhost:3002/api/parse-full-order', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    message: testMessage
  })
})
.then(res => res.json())
.then(data => {
  console.log('\n=== 응답 결과 ===');
  console.log('Status:', data.status);
  console.log('Items:', data.parsed_items?.length || 0, '개');
  
  if (data.parsed_items && data.parsed_items.length > 0) {
    const item = data.parsed_items[0];
    console.log('\n=== 첫 번째 아이템 ===');
    console.log('Name:', item.name);
    console.log('Resolved:', item.resolved);
    console.log('Item No:', item.item_no);
    console.log('Item Name:', item.item_name);
    console.log('Suggestions:', item.suggestions?.length || 0, '개');
    
    if (item.suggestions && item.suggestions.length > 0) {
      console.log('\n=== Suggestions ===');
      item.suggestions.forEach((s, i) => {
        console.log(`${i+1}. ${s.item_no} - ${s.item_name}`);
        console.log(`   Score: ${s.score}, is_new_item: ${s.is_new_item}`);
      });
    }
  }
  
  console.log('\n=== 전체 응답 ===');
  console.log(JSON.stringify(data, null, 2));
})
.catch(err => {
  console.error('Error:', err.message);
});
