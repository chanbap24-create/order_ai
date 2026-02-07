const Database = require('better-sqlite3');
const db = new Database('data.sqlite3', { readonly: true });

console.log('🔍 "클레멍 라발리 샤블리" 검색 디버깅\n');

// 1. 별칭 확인
console.log('1️⃣ 별칭 테이블에서 "cl" 확인:');
const aliases = db.prepare(`
  SELECT alias, canonical, count 
  FROM item_alias 
  WHERE alias = 'cl' OR canonical LIKE '%클레멍%'
  ORDER BY count DESC
`).all();

if (aliases.length > 0) {
  aliases.forEach(a => {
    console.log(`   ✅ ${a.alias} → ${a.canonical} (${a.count}회)`);
  });
} else {
  console.log('   ❌ 별칭 없음');
}

// 2. 입고 데이터 확인
console.log('\n2️⃣ 입고 데이터에서 "CL 샤블리" 검색:');
const tables = ['items', 'Downloads_items', 'item_master'];

for (const table of tables) {
  try {
    const items = db.prepare(`
      SELECT item_no, item_name 
      FROM ${table} 
      WHERE item_name LIKE '%CL%샤블리%' 
         OR item_name LIKE '%클레멍%샤블리%'
         OR item_name LIKE '%샹트%메흘르%'
      LIMIT 10
    `).all();
    
    if (items.length > 0) {
      console.log(`\n   ✅ ${table} 테이블 (${items.length}건):`);
      items.forEach(item => {
        console.log(`      ${item.item_no}: ${item.item_name}`);
      });
    }
  } catch (err) {
    // 테이블이 없으면 스킵
  }
}

// 3. 보졸레 데이터 확인
console.log('\n3️⃣ 보졸레 데이터 (왜 나왔을까?):');
for (const table of tables) {
  try {
    const items = db.prepare(`
      SELECT item_no, item_name 
      FROM ${table} 
      WHERE item_name LIKE '%보졸레%' 
         OR item_name LIKE '%라발리%'
      LIMIT 5
    `).all();
    
    if (items.length > 0) {
      console.log(`\n   ${table} 테이블:`);
      items.forEach(item => {
        console.log(`      ${item.item_no}: ${item.item_name}`);
      });
    }
  } catch (err) {
    // 테이블이 없으면 스킵
  }
}

// 4. 양방향 별칭 확장 시뮬레이션
console.log('\n4️⃣ 별칭 확장 시뮬레이션:');
const input = '클레멍 라발리 샤블리';
console.log(`   입력: "${input}"`);

// 역방향 캐시
const reverseAliases = new Map();
aliases.forEach(a => {
  const canonicalLower = a.canonical.toLowerCase();
  if (!reverseAliases.has(canonicalLower)) {
    reverseAliases.set(canonicalLower, []);
  }
  reverseAliases.get(canonicalLower).push(a.alias.toLowerCase());
});

const lowerInput = input.toLowerCase();
const wordsToAdd = [];

for (const [canonical, aliasesList] of reverseAliases.entries()) {
  const normalizedCanonical = canonical.replace(/\s+/g, '');
  const normalizedInput = lowerInput.replace(/\s+/g, '');
  
  if (normalizedInput.includes(normalizedCanonical) || lowerInput.includes(canonical)) {
    const shortestAlias = aliasesList.sort((a, b) => a.length - b.length)[0];
    console.log(`   ✅ "${canonical}" 매칭 → +${shortestAlias}`);
    wordsToAdd.push(shortestAlias);
  }
}

const expanded = input + ' ' + wordsToAdd.join(' ');
console.log(`   최종: "${expanded}"`);

db.close();
