const Database = require('better-sqlite3');
const db = new Database('./data.sqlite3');

console.log('🔍 품목명 인코딩 및 표기 분석\n');

const target = db.prepare('SELECT * FROM items WHERE item_no = ?').get('3022042');
const candidates = ['3021701', '3022043', '3022406', '3022705', '3020050'];

console.log('📌 타겟 품목 (3022042):');
console.log('품목명:', target.item_name);
console.log('');

// 문자열 분석
const analysis = {
  '한글': /[가-힣]/.test(target.item_name),
  '영어': /[a-zA-Z]/.test(target.item_name),
  '숫자': /[0-9]/.test(target.item_name),
  '따옴표': /[""]/.test(target.item_name),
};

console.log('문자 구성:');
Object.entries(analysis).forEach(([key, val]) => {
  console.log(`  ${val ? '✅' : '❌'} ${key}`);
});

console.log('\n포함된 단어:');
const words = target.item_name.split(/[\s,]+/);
words.forEach((word, idx) => {
  console.log(`  ${idx+1}. "${word}"`);
});

// 후보군 비교
console.log('\n📌 후보군 품목명 비교:');
candidates.forEach(code => {
  const item = db.prepare('SELECT * FROM items WHERE item_no = ?').get(code);
  if (item) {
    const hasLouis = item.item_name.includes('루이');
    const hasMichel = item.item_name.includes('미셸');
    const hasChablis = item.item_name.includes('샤블리');
    console.log(`\n[${item.item_no}]`);
    console.log(`  품목명: ${item.item_name}`);
    console.log(`  루이: ${hasLouis ? '✅' : '❌'}, 미셸: ${hasMichel ? '✅' : '❌'}, 샤블리: ${hasChablis ? '✅' : '❌'}`);
  }
});

// 정규화 비교
console.log('\n📌 정규화 후 비교:');
function normalize(str) {
  return str.toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[""'']/g, '')
    .replace(/[()\-_/.,]/g, '');
}

console.log('타겟 정규화:', normalize(target.item_name));
console.log('\n검색어 정규화:');
const queries = [
  '루이미쉘 Chablis Montee de tonnerre',
  '루이미셸 샤블리 몬테 드 토네흐',
  '루이 미셸 샤블리 1er Cru 몬테',
];

queries.forEach(q => {
  console.log(`  "${q}" → "${normalize(q)}"`);
});

db.close();
