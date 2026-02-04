const Database = require('better-sqlite3');
const db = new Database('./data.sqlite3');

console.log('🔍 Debugging: "루이미쉘 Chablis Montee de tonnerre 1er Cru 2021 2"');
console.log('=' .repeat(80));

// 1. 3022042 품목이 실제로 존재하는지 확인
console.log('\n📌 Step 1: 품목코드 3022042 확인');
const target = db.prepare(`
  SELECT item_no, item_name, name_en, name_kr 
  FROM items 
  WHERE item_no = '3022042'
`).get();

if (target) {
  console.log('✅ 품목 존재:');
  console.log('  - 품목코드:', target.item_no);
  console.log('  - 품목명:', target.item_name);
  console.log('  - English:', target.name_en);
  console.log('  - Korean:', target.name_kr);
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
`).all();

console.log(`총 ${history.length}개 품목 히스토리`);
const has3022042 = history.find(h => h.item_no === '3022042');
if (has3022042) {
  console.log('✅ 거래처 히스토리에 3022042 있음:', has3022042);
} else {
  console.log('❌ 거래처 히스토리에 3022042 없음');
}

// 3. "Montee de tonnerre" 검색
console.log('\n📌 Step 3: "Montee de tonnerre" 키워드로 검색');
const searchResults = db.prepare(`
  SELECT item_no, item_name, name_en, name_kr
  FROM items
  WHERE 
    LOWER(item_name) LIKE '%montee%' OR
    LOWER(item_name) LIKE '%tonnerre%' OR
    LOWER(name_en) LIKE '%montee%' OR
    LOWER(name_en) LIKE '%tonnerre%' OR
    LOWER(name_kr) LIKE '%몽테%' OR
    LOWER(name_kr) LIKE '%토네르%'
  LIMIT 20
`).all();

console.log(`총 ${searchResults.length}개 결과:`);
searchResults.forEach((item, idx) => {
  const mark = item.item_no === '3022042' ? '🎯' : '  ';
  console.log(`${mark} ${idx+1}. [${item.item_no}] ${item.item_name}`);
});

// 4. 루이미셸 + 샤블리 조합 검색
console.log('\n📌 Step 4: "루이미셸" + "샤블리" 조합 검색');
const comboResults = db.prepare(`
  SELECT item_no, item_name, name_en, name_kr
  FROM items
  WHERE 
    (LOWER(item_name) LIKE '%louis%' OR LOWER(item_name) LIKE '%michel%' OR LOWER(name_kr) LIKE '%루이%') AND
    (LOWER(item_name) LIKE '%chablis%' OR LOWER(name_kr) LIKE '%샤블리%')
  LIMIT 20
`).all();

console.log(`총 ${comboResults.length}개 결과:`);
comboResults.forEach((item, idx) => {
  const mark = item.item_no === '3022042' ? '🎯' : '  ';
  console.log(`${mark} ${idx+1}. [${item.item_no}] ${item.item_name}`);
});

// 5. 정확한 이름으로 검색
console.log('\n📌 Step 5: 정규화된 품목명 비교');
if (target) {
  console.log('타겟 품목명 분석:');
  console.log('  - 원본:', target.item_name);
  console.log('  - 소문자:', target.item_name.toLowerCase());
  console.log('  - 포함 키워드:');
  const keywords = ['louis', 'michel', 'chablis', 'montee', 'tonnerre', '1er', 'cru'];
  keywords.forEach(kw => {
    const has = target.item_name.toLowerCase().includes(kw);
    console.log(`    - ${kw}: ${has ? '✅' : '❌'}`);
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

console.log('\n' + '='.repeat(80));
console.log('✅ 디버깅 완료');

db.close();
