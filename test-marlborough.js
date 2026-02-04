const fetch = require('node-fetch');

async function testMarlborough() {
  console.log('=== 말보로 검색 테스트 ===\n');
  
  const payload = {
    message: '확인필요\n레이크 칼리스 말보로 쇼블 / 6병',
    client_code: '32076'  // 무스
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
        
        console.log('Top 5 후보:');
        item.candidates.slice(0, 5).forEach((c, i) => {
          console.log(`${i+1}. [${c.item_no}] ${c.item_name}`);
          console.log(`   점수: ${c.score}, 신규: ${c.is_new_item}, 공급가: ${c.supply_price}`);
          if (c._debug) {
            console.log(`   디버그: korean=${c._debug.koreanScore}, english=${c._debug.englishScore}`);
          }
          console.log('');
        });
        
        // 3A24401 찾기
        const marlborough = item.candidates.find(c => c.item_no === '3A24401');
        if (marlborough) {
          console.log('✅ 말보로 품목 찾음:', marlborough.item_no, marlborough.item_name);
          console.log('   점수:', marlborough.score);
        } else {
          console.log('❌ 말보로 품목(3A24401)을 후보에서 찾을 수 없음!');
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testMarlborough();
