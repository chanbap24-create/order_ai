const Database = require('better-sqlite3');
const db = new Database('./data.sqlite3');

console.log('🔍 Debugging: "루이미쉘 Chablis Montee de tonnerre 1er Cru 2021"');
console.log('거래처: 배산임수 (30694)');
console.log('=' .repeat(80));

// 1. 3022042 품목이 실제로 존재하는지 확인
console.log('\n📌 Step 1: 품목코드 3022042 확인');
const target = db.prepare(`
  SELECT item_no, item_name
  FROM items 
  WHERE item_no = '3022042'
`).get();

if (target) {
  console.log('✅ 품목 존재:');
  console.log('  - 품목코드:', target.item_no);
  console.log('  - 품목명:', target.item_name);
} else {
  console.log('❌ 품목코드 3022042가 DB에 없습니다!');
}

// 2. 거래처 히스토리 확인
console.log('\n📌 Step 2: 거래처(30694) 히스토리 확인');
const history = db.prepare(`
  SELECT item_no, item_name, COUNT(*) as count
  FROM client_item_stats
  WHERE client_code = '30694'
  GROUP BY item_no, item_name
  ORDER BY count DESC
  LIMIT 10
`).all();

console.log(`총 ${history.length}개 품목 히스토리 (상위 10개):`);
history.forEach((h, idx) => {
  const mark = h.item_no === '3022042' ? '🎯' : '  ';
  console.log(`${mark} ${idx+1}. [${h.item_no}] ${h.item_name} (${h.count}회)`);
});

const has3022042 = history.find(h => h.item_no === '3022042');
if (has3022042) {
  console.log('✅ 거래처 히스토리에 3022042 있음');
} else {
  console.log('❌ 거래처 히스토리에 3022042 없음');
}

// 3. "Montee de tonnerre" 검색
console.log('\n📌 Step 3: "Montee de tonnerre" 키워드로 검색');
const searchResults = db.prepare(`
  SELECT item_no, item_name
  FROM items
  WHERE 
    LOWER(REPLACE(item_name, ' ', '')) LIKE '%montee%' OR
    LOWER(REPLACE(item_name, ' ', '')) LIKE '%tonnerre%' OR
    LOWER(REPLACE(item_name, ' ', '')) LIKE '%montéedetonnerre%'
  LIMIT 20
`).all();

console.log(`총 ${searchResults.length}개 결과:`);
searchResults.forEach((item, idx) => {
  const mark = item.item_no === '3022042' ? '🎯' : '  ';
  console.log(`${mark} ${idx+1}. [${item.item_no}] ${item.item_name}`);
});

// 4. 루이미셸 + 샤블리 조합 검색
console.log('\n📌 Step 4: "Louis Michel" + "Chablis" 조합 검색');
const comboResults = db.prepare(`
  SELECT item_no, item_name
  FROM items
  WHERE 
    (LOWER(item_name) LIKE '%louis%' AND LOWER(item_name) LIKE '%michel%') AND
    LOWER(item_name) LIKE '%chablis%'
  ORDER BY item_no
`).all();

console.log(`총 ${comboResults.length}개 결과:`);
comboResults.forEach((item, idx) => {
  const mark = item.item_no === '3022042' ? '🎯' : '  ';
  console.log(`${mark} ${idx+1}. [${item.item_no}] ${item.item_name}`);
});

// 5. 정확한 이름으로 검색
console.log('\n📌 Step 5: 타겟 품목명 키워드 분석');
if (target) {
  console.log('타겟 품목명:', target.item_name);
  console.log('포함 키워드 체크:');
  const keywords = ['louis', 'michel', 'chablis', 'montee', 'montée', 'tonnerre', '1er', 'cru', 'butteaux'];
  keywords.forEach(kw => {
    const has = target.item_name.toLowerCase().includes(kw);
    console.log(`  ${has ? '✅' : '❌'} ${kw}`);
  });
}

// 6. 후보군에 나온 품목들 확인
console.log('\n📌 Step 6: 실제 후보군 품목들 확인');
const candidates = ['3021701', '3022043', '3022406', '3022705', '3020050'];
console.log('스크린샷에 나온 후보군:');
candidates.forEach(code => {
  const item = db.prepare('SELECT item_no, item_name FROM items WHERE item_no = ?').get(code);
  if (item) {
    console.log(`  [${item.item_no}] ${item.item_name}`);
  }
});

// 7. "1er Cru" 검색
console.log('\n📌 Step 7: Louis Michel + Chablis + 1er Cru 검색');
const premierCru = db.prepare(`
  SELECT item_no, item_name
  FROM items
  WHERE 
    LOWER(item_name) LIKE '%louis%michel%' AND
    LOWER(item_name) LIKE '%chablis%' AND
    LOWER(item_name) LIKE '%1er%cru%'
`).all();

console.log(`총 ${premierCru.length}개 결과:`);
premierCru.forEach((item, idx) => {
  const mark = item.item_no === '3022042' ? '🎯' : '  ';
  console.log(`${mark} ${idx+1}. [${item.item_no}] ${item.item_name}`);
});

console.log('\n' + '='.repeat(80));
console.log('✅ 디버깅 완료');

db.close();
