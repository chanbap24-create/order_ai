const XLSX = require('xlsx');
const fs = require('fs');

const workbook = XLSX.readFile('order-ai.xlsx');
const sheetName = 'English';
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

console.log('📊 Excel 구조 분석 중...\n');

// 실제 데이터 시작 행 찾기 (Row 4부터가 실제 데이터)
const headerRow = 2; // 0-indexed, 실제 Row 3
const dataStartRow = 4; // 0-indexed, 실제 Row 5

// 헤더 확인
console.log('📋 Row 2 (헤더):', data[headerRow]);
console.log('📋 Row 3 (서브헤더):', data[headerRow + 1]);
console.log('📋 Row 4 (첫 데이터):', data[dataStartRow], '\n');

const producers = new Map();

// D=국가(column 3), E=공급자명 영어(column 4), M=공급자명 한글(column 12)
for (let i = dataStartRow; i < data.length; i++) {
  const row = data[i];
  if (!row || row.length === 0) continue;
  
  const country = String(row[3] || '').trim();
  const supplierEN = String(row[4] || '').trim();
  
  // M 컬럼은 실제로 존재하지 않을 수 있으므로 I 컬럼(한글 상품명)에서 추출 시도
  // 또는 별도 매핑 필요
  const productKO = String(row[8] || '').trim(); // I 컬럼 (Kor.)
  
  if (country && supplierEN) {
    if (!producers.has(supplierEN)) {
      producers.set(supplierEN, {
        en: supplierEN,
        ko: '', // 한글 생산자명은 별도 매핑 필요
        countries: new Set()
      });
    }
    producers.get(supplierEN).countries.add(country);
  }
}

console.log(`✅ 발견된 생산자: ${producers.size}개\n`);

// 국가별 그룹화
const byCountry = {};
producers.forEach((info, name) => {
  info.countries.forEach(country => {
    if (!byCountry[country]) byCountry[country] = [];
    byCountry[country].push(name);
  });
});

// 국가별 출력
console.log('🌍 국가별 생산자:\n');
Object.keys(byCountry).sort().forEach(country => {
  console.log(`${country}: ${byCountry[country].length}개`);
  byCountry[country].sort().forEach(name => {
    console.log(`  - ${name}`);
  });
  console.log('');
});

// TypeScript 코드 생성
const lines = [
  '// 자동 생성된 생산자 목록 (order-ai.xlsx English 시트 기준)',
  '// 생성 시각: ' + new Date().toISOString(),
  '',
  'export const WINE_PRODUCERS_NEW = ['
];

Object.keys(byCountry).sort().forEach(country => {
  lines.push(`  // ${country} (${byCountry[country].length}개)`);
  byCountry[country].sort().forEach(name => {
    lines.push(`  '${name.toLowerCase()}',`);
  });
  lines.push('');
});

lines.push('] as const;');
lines.push('');
lines.push('// 전체 생산자 수: ' + producers.size);

fs.writeFileSync('producers_new_v3.ts', lines.join('\n'));
console.log('✅ producers_new_v3.ts 파일 생성 완료!');
console.log('📝 총 생산자 수:', producers.size);
