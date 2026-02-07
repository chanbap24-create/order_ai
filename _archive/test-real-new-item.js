const fetch = require('node-fetch');

async function testRealNewItem() {
  console.log('=== 실제 신규 품목 테스트 ===\n');
  
  // DB에서 신규 품목 찾기
  const Database = require('better-sqlite3');
  const db = new Database('./data.sqlite3');
  
  // 거래처 30694(배산임수)에서 구매한 적 없는 품목 찾기
  const allItems = db.prepare('SELECT item_no, item_name FROM items LIMIT 20').all();
  const clientHistory = db.prepare('SELECT DISTINCT item_no FROM client_item_stats WHERE client_code = ?').all('30694');
  const historySet = new Set(clientHistory.map(r => r.item_no));
  
  const newItem = allItems.find(item => !historySet.has(item.item_no));
  
  if (!newItem) {
    console.log('❌ 신규 품목을 찾을 수 없습니다');
    return;
  }
  
  console.log('신규 품목:', newItem.item_no, newItem.item_name);
  console.log('');
  
  const payload = {
    message: `배산임수\n${newItem.item_name} / 10병`,
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
        console.log('  is_new_item:', top.is_new_item);
        console.log('  score:', top.score);
        console.log('');
        
        // ✅ 검증
        if (top.is_new_item === true && item.resolved === true) {
          console.log('❌ 실패: 신규 품목인데 자동 확정됨!');
        } else if (top.is_new_item === true && item.resolved !== true) {
          console.log('✅ 성공: 신규 품목은 자동 확정 안 됨!');
        } else if (top.is_new_item !== true && item.resolved === true) {
          console.log('✅ 성공: 기존 품목은 자동 확정됨!');
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    db.close();
  }
}

testRealNewItem();
