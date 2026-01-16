const XLSX = require('xlsx');

// Excel 파일 읽기
const workbook = XLSX.readFile('order-ai.xlsx');
const sheet = workbook.Sheets['English'];

// 시트를 JSON으로 변환
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log(`총 ${data.length}개 행 발견`);

// D=국가, E=공급자명(영어), M=공급자명(한글)
const producers = new Set();
const producersByCountry = {};

// 헤더 행을 건너뛰고 데이터 읽기
for (let i = 1; i < data.length; i++) {
  const row = data[i];
  const country = row[3]; // D 컬럼 (0-indexed: 3)
  const supplierEn = row[4]; // E 컬럼 (0-indexed: 4)
  const supplierKo = row[12]; // M 컬럼 (0-indexed: 12)
  
  // 공급자명이 있으면 추가
  if (supplierEn && supplierEn.toString().trim()) {
    const en = supplierEn.toString().trim();
    producers.add(en);
    
    if (country) {
      if (!producersByCountry[country]) {
        producersByCountry[country] = { ko: new Set(), en: new Set() };
      }
      producersByCountry[country].en.add(en);
    }
  }
  
  if (supplierKo && supplierKo.toString().trim()) {
    const ko = supplierKo.toString().trim();
    producers.add(ko);
    
    if (country) {
      if (!producersByCountry[country]) {
        producersByCountry[country] = { ko: new Set(), en: new Set() };
      }
      producersByCountry[country].ko.add(ko);
    }
  }
}

console.log(`\n중복 제거 후 총 ${producers.size}개 생산자 발견`);

// 국가별 분류
console.log('\n=== 국가별 생산자 수 ===');
for (const [country, prods] of Object.entries(producersByCountry)) {
  const koCount = prods.ko.size;
  const enCount = prods.en.size;
  console.log(`${country}: 한글 ${koCount}개, 영문 ${enCount}개`);
}

// TypeScript 배열 형식으로 출력
console.log('\n=== WINE_PRODUCERS 배열 (국가별 분류) ===\n');

console.log('const WINE_PRODUCERS = [');

// 국가별로 정렬하여 출력
const countries = Object.keys(producersByCountry).sort();

for (const country of countries) {
  const prods = producersByCountry[country];
  
  console.log(`  // ===== ${country} =====`);
  
  // 한글 생산자
  if (prods.ko.size > 0) {
    const koList = Array.from(prods.ko).sort();
    console.log(`  // 한글 (${koList.length}개)`);
    const koStr = koList.map(p => `'${p}'`).join(', ');
    console.log(`  ${koStr},\n`);
  }
  
  // 영문 생산자
  if (prods.en.size > 0) {
    const enList = Array.from(prods.en).sort();
    console.log(`  // 영문 (${enList.length}개)`);
    const enStr = enList.map(p => `'${p.toLowerCase()}'`).join(', ');
    console.log(`  ${enStr},\n`);
  }
}

console.log('];');

// 전체 리스트 (중복 제거, 정렬)
console.log('\n\n=== 전체 생산자 리스트 (알파벳순) ===\n');
const allProducers = Array.from(producers).sort();
allProducers.forEach(p => console.log(`  '${p}',`));

