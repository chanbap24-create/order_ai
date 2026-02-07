const XLSX = require('xlsx');
const fs = require('fs');

// Excel 파일 읽기
const workbook = XLSX.readFile('order-ai.xlsx');
const sheet = workbook.Sheets['English'];

// 시트를 JSON으로 변환
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log(`총 ${data.length}개 행 발견\n`);

// 헤더 확인
const header = data[0];
console.log('헤더:', header);
console.log('D컬럼(3):', header[3]);
console.log('E컬럼(4):', header[4]);
console.log('M컬럼(12):', header[12]);
console.log();

const producersByCountry = {};
let totalEn = 0;
let totalKo = 0;

// 데이터 읽기 (행 1부터 시작, 헤더 제외)
for (let i = 1; i < data.length; i++) {
  const row = data[i];
  const country = row[3]; // D 컬럼
  const supplierEn = row[4]; // E 컬럼
  const supplierKo = row[12]; // M 컬럼
  
  if (!country || country.toString().includes('국가')) continue;
  
  const countryStr = country.toString().trim();
  
  if (!producersByCountry[countryStr]) {
    producersByCountry[countryStr] = { ko: new Set(), en: new Set() };
  }
  
  if (supplierEn && supplierEn.toString().trim() && !supplierEn.toString().includes('공급자명')) {
    const en = supplierEn.toString().trim();
    producersByCountry[countryStr].en.add(en);
    totalEn++;
  }
  
  if (supplierKo && supplierKo.toString().trim() && !supplierKo.toString().includes('공급자명')) {
    const ko = supplierKo.toString().trim();
    producersByCountry[countryStr].ko.add(ko);
    totalKo++;
  }
}

console.log(`영문 생산자: ${totalEn}개`);
console.log(`한글 생산자: ${totalKo}개\n`);

// 국가별 통계
console.log('=== 국가별 생산자 수 ===');
const countries = Object.keys(producersByCountry).sort();
for (const country of countries) {
  const prods = producersByCountry[country];
  console.log(`${country}: 한글 ${prods.ko.size}개, 영문 ${prods.en.size}개`);
}

// TypeScript 코드 생성
let tsCode = `/* ================= 생산자 목록 (order-ai.xlsx English 시트에서 자동 생성) ================= */\n\n`;
tsCode += `const WINE_PRODUCERS = [\n`;

for (const country of countries) {
  const prods = producersByCountry[country];
  
  tsCode += `  // ===== ${country} =====\n`;
  
  // 한글 생산자
  if (prods.ko.size > 0) {
    const koList = Array.from(prods.ko).sort();
    tsCode += `  // 한글 (${koList.length}개)\n`;
    const koStr = koList.map(p => `'${p}'`).join(', ');
    tsCode += `  ${koStr},\n\n`;
  }
  
  // 영문 생산자
  if (prods.en.size > 0) {
    const enList = Array.from(prods.en).sort();
    tsCode += `  // 영문 (${enList.length}개)\n`;
    const enStr = enList.map(p => `'${p.toLowerCase()}'`).join(', ');
    tsCode += `  ${enStr},\n\n`;
  }
}

// 기존 약어 및 일반 용어 추가
tsCode += `  // ===== 약어 및 일반 용어 =====\n`;
tsCode += `  'ch', 'dom', 'domaine', 'chateau', 'maison', 'mt', 'rd', 'rg', 'drc',\n`;
tsCode += `  'barolo', 'brunello', 'chianti', 'barbaresco', 'amarone',\n`;
tsCode += `  'sangiovese', 'nebbiolo', 'montalcino', 'valpolicella', 'superiore',\n`;

tsCode += `];\n`;

// 파일 저장
fs.writeFileSync('producers_new.ts', tsCode);
console.log('\n✅ producers_new.ts 파일 생성 완료!');
console.log('이제 이 내용을 app/lib/resolveItemsWeighted.ts에 반영하겠습니다.\n');

