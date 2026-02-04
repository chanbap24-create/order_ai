const fetch = require('node-fetch');

async function testNewItemNoResolve() {
  console.log('=== 신규 품목 자동 확정 방지 테스트 ===\n');
  
  const payload = {
    message: '배산임수\n신규 품목 테스트 / 10병',
    client_code: '30694'
  };

  try {
    const response = await fetch('http://localhost:3000/api/parse-full-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    
    console.log('응답 상태:', data.status);
    console.log('');
    
    if (data.parsed_items && data.parsed_items.length > 0) {
      const item = data.parsed_items[0];
      console.log('품목명:', item.name);
      console.log('resolved:', item.resolved);
      console.log('');
      
      if (item.candidates && item.candidates.length > 0) {
        console.log('후보 수:', item.candidates.length);
        console.log('');
        
        const top = item.candidates[0];
        console.log('1순위 후보:');
        console.log('  item_no:', top.item_no);
        console.log('  item_name:', top.item_name);
        console.log('  is_new_item:', top.is_new_item);
        console.log('  score:', top.score);
        console.log('  supply_price:', top.supply_price);
        console.log('');
        
        // ✅ 검증
        if (top.is_new_item === true && item.resolved === true) {
          console.log('❌ 실패: 신규 품목인데 자동 확정됨!');
        } else if (top.is_new_item === true && item.resolved !== true) {
          console.log('✅ 성공: 신규 품목은 자동 확정 안 됨!');
        } else if (top.is_new_item !== true && item.resolved === true) {
          console.log('✅ 성공: 기존 품목은 자동 확정됨!');
        } else {
          console.log('⚠️  기타 상황:', {
            is_new_item: top.is_new_item,
            resolved: item.resolved
          });
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testNewItemNoResolve();
