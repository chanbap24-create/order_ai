const { db } = require('./app/lib/db.ts');

// 테스트: 메종 로쉬 벨렌 검색
console.log('\n=== 테스트 1: 메종 로쉬 벨렌 (2017824) 검색 ===\n');

try {
  // 1. items 테이블에서 2017824 검색
  const items = db.prepare(`
    SELECT item_no, item_name 
    FROM items 
    WHERE item_no = '2017824'
  `).all();
  
  console.log('📦 items 테이블:', JSON.stringify(items, null, 2));
  
  // 2. client_item_stats에서 2017824 검색 (거래처 30694)
  const clientItems = db.prepare(`
    SELECT item_no, item_name, client_code
    FROM client_item_stats 
    WHERE item_no = '2017824' AND client_code = '30694'
  `).all();
  
  console.log('\n👤 client_item_stats (30694):', JSON.stringify(clientItems, null, 2));
  
  // 3. 별칭 테이블 확인
  const aliases = db.prepare(`
    SELECT item_no, alias, canonical
    FROM item_aliases 
    WHERE item_no = '2017824'
  `).all();
  
  console.log('\n🏷️  item_aliases:', JSON.stringify(aliases, null, 2));
  
} catch (e) {
  console.error('❌ 오류:', e.message);
}

console.log('\n=== 테스트 2: 클레멍 라발리 샤블리 검색 ===\n');

try {
  // 샹트메흘르 검색
  const chantemerle = db.prepare(`
    SELECT item_no, item_name 
    FROM items 
    WHERE item_name LIKE '%클레멍%' AND item_name LIKE '%샹트%'
    LIMIT 10
  `).all();
  
  console.log('🍷 클레멍 라발리 샹트메흘르:', JSON.stringify(chantemerle, null, 2));
  
  // 모든 클레멍 라발리 샤블리 검색
  const allClement = db.prepare(`
    SELECT item_no, item_name 
    FROM items 
    WHERE item_name LIKE '%클레멍%' AND item_name LIKE '%샤블리%'
    ORDER BY item_no
    LIMIT 10
  `).all();
  
  console.log('\n🍷 모든 클레멍 라발리 샤블리:', JSON.stringify(allClement, null, 2));
  
  // 거래처 입고 내역
  const clientClement = db.prepare(`
    SELECT item_no, item_name, purchase_count
    FROM client_item_stats 
    WHERE client_code = '30694' 
      AND item_name LIKE '%클레멍%' 
      AND item_name LIKE '%샤블리%'
    ORDER BY purchase_count DESC
    LIMIT 10
  `).all();
  
  console.log('\n👤 거래처 30694 클레멍 라발리 입고내역:', JSON.stringify(clientClement, null, 2));
  
} catch (e) {
  console.error('❌ 오류:', e.message);
}

db.close();
