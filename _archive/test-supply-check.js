const fetch = require('node-fetch');

async function test() {
  console.log('=== 공급가 테스트 시작 ===\n');
  
  const response = await fetch('http://localhost:3000/api/parse-full-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: '배산임수\n찰스하이직 / CH 찰스 하이직 브륏 리저브 / 2병'
    })
  });
  
  const data = await response.json();
  console.log('응답 상태:', data.status);
  
  if (data.parsed_items && data.parsed_items.length > 0) {
    const item = data.parsed_items[0];
    console.log('\n품목명:', item.name);
    
    const candidates = item.candidates || [];
    console.log('후보 개수:', candidates.length);
    
    candidates.slice(0, 3).forEach((c, i) => {
      console.log(`\n[후보 ${i+1}]`);
      console.log(`  품목번호: ${c.item_no}`);
      console.log(`  품목명: ${c.item_name}`);
      console.log(`  is_new_item: ${c.is_new_item}`);
      console.log(`  supply_price: ${c.supply_price}`);
      if (c.supply_price) {
        console.log(`  ✅ 공급가: ${Number(c.supply_price).toLocaleString()}원`);
      } else {
        console.log(`  ❌ 공급가 없음`);
      }
    });
  }
}

test().catch(console.error);
