const Database = require('better-sqlite3');
const db = new Database('./data.sqlite3', { readonly: true });

console.log('\n=== 알마로사 피노누아 확인 ===\n');

// 1. 품목 기본 정보
const item = db.prepare(`
  SELECT item_no, item_name_kr, item_name_en
  FROM items
  WHERE item_no = '2421005'
`).get();

console.log('1. 품목 정보:');
console.log('   item_no:', item?.item_no);
console.log('   한글명:', item?.item_name_kr);
console.log('   영문명:', item?.item_name_en);

// 2. 거래처 정보
const client = db.prepare(`
  SELECT id, name
  FROM clients
  WHERE name LIKE '%배산임수%'
`).get();

console.log('\n2. 거래처 정보:');
console.log('   id:', client?.id);
console.log('   name:', client?.name);

// 3. client_item_stats 확인
const stats = db.prepare(`
  SELECT *
  FROM client_item_stats
  WHERE client_id = ? AND item_no = ?
`).get(client?.id, '2421005');

console.log('\n3. client_item_stats:');
if (stats) {
  console.log('   ✅ 기록 있음!');
  console.log('   client_id:', stats.client_id);
  console.log('   item_no:', stats.item_no);
  console.log('   total_quantity:', stats.total_quantity);
  console.log('   order_count:', stats.order_count);
  console.log('   last_order_date:', stats.last_order_date);
  console.log('   first_order_date:', stats.first_order_date);
} else {
  console.log('   ❌ 기록 없음! (is_new_item=true가 되어야 함)');
}

// 4. 전체 거래처 중 이 품목을 주문한 이력이 있는지 확인
const allStats = db.prepare(`
  SELECT c.name as client_name, s.*
  FROM client_item_stats s
  JOIN clients c ON c.id = s.client_id
  WHERE s.item_no = '2421005'
`).all();

console.log('\n4. 전체 거래처 중 2421005 주문 이력:');
if (allStats.length > 0) {
  console.log(`   총 ${allStats.length}개 거래처에서 주문함`);
  allStats.forEach(s => {
    console.log(`   - ${s.client_name}: ${s.total_quantity}병 (${s.order_count}회)`);
  });
} else {
  console.log('   없음');
}

// 5. items 테이블에서 is_new_item 확인
const itemInfo = db.prepare(`
  SELECT item_no, item_name_kr, is_new_item
  FROM items
  WHERE item_no = '2421005'
`).get();

console.log('\n5. items 테이블의 is_new_item:');
console.log('   is_new_item:', itemInfo?.is_new_item);
console.log('   (참고: 이 컬럼은 더 이상 사용하지 않고 client_item_stats로 판단)');

console.log('\n=== 결론 ===');
if (stats) {
  console.log('✅ client_item_stats에 기록이 있음');
  console.log('→ is_new_item = FALSE 여야 함 (기존 품목)');
  console.log('→ 하지만 화면에는 "신규" 배지가 표시됨');
  console.log('→ 코드 로직을 확인해야 함!');
} else {
  console.log('❌ client_item_stats에 기록이 없음');
  console.log('→ is_new_item = TRUE (신규 품목)');
  console.log('→ 화면 표시가 맞음');
}

db.close();
