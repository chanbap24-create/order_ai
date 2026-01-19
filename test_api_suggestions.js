async function testAPI() {
  const response = await fetch('https://order-ai-one.vercel.app/api/parse-full-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: '스시인\n링트레일스 씨더메인 카베르네쇼뉴 3병',
      force_resolve: true
    })
  });
  
  const data = await response.json();
  
  if (data.parsed_items && data.parsed_items.length > 0) {
    const item = data.parsed_items[0];
    console.log('=== 품목 정보 ===');
    console.log('이름:', item.name);
    console.log('수량:', item.qty);
    console.log('resolved:', item.resolved);
    console.log('suggestions 개수:', item.suggestions?.length);
    
    if (item.suggestions && item.suggestions.length > 0) {
      console.log('\n=== suggestions 목록 (최대 10개) ===');
      item.suggestions.slice(0, 10).forEach((s, idx) => {
        console.log(`${idx + 1}. ${s.item_no} - ${s.item_name?.substring(0, 50)} (${s.score})`);
      });
    }
    
    console.log('\n=== 결론 ===');
    console.log(`총 suggestions: ${item.suggestions?.length || 0}개`);
    console.log(`더보기 작동: ${(item.suggestions?.length || 0) > 4 ? 'YES ✅' : 'NO ❌ - API 수정 필요!'}`);
  } else {
    console.log('parsed_items 없음:', data.parsed_items);
    console.log('전체 응답:', JSON.stringify(data, null, 2).substring(0, 1000));
  }
}

testAPI().catch(console.error);
