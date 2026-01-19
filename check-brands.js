const XLSX = require('xlsx');
const path = require('path');

const xlsxPath = path.join(__dirname, 'order-ai.xlsx');
const workbook = XLSX.readFile(xlsxPath);
const sheet = workbook.Sheets['English'];

const jsonData = XLSX.utils.sheet_to_json(sheet, {
  range: 4,
  header: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'],
  defval: '',
});

console.log('=== English 시트 브랜드명 샘플 (E열 영문, M열 한글) ===\n');

// 중복 제거
const brands = new Map();
for (const row of jsonData) {
  if (!row.B) continue;
  const en = String(row.E || '').trim();
  const kr = String(row.M || '').trim();
  const key = en.toLowerCase();
  if (key && !brands.has(key)) {
    brands.set(key, { en, kr });
  }
}

// 샘플 출력
let count = 0;
for (const [key, brand] of brands) {
  console.log(`${++count}. E열(영문): ${brand.en}`);
  console.log(`   M열(한글): ${brand.kr}`);
  console.log('');
  if (count >= 20) break;
}

console.log(`\n총 ${brands.size}개의 브랜드`);

// "클레멍" 포함 브랜드 검색
console.log('\n=== "클레멍" 관련 브랜드 검색 ===\n');
for (const [key, brand] of brands) {
  if (brand.kr.includes('클레멍') || brand.en.toLowerCase().includes('clement')) {
    console.log(`- ${brand.kr} (${brand.en})`);
  }
}
