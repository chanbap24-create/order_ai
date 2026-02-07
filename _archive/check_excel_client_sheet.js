const XLSX = require('xlsx');

console.log('📊 order-ai.xlsx Client 시트 확인\n');

const workbook = XLSX.readFile('order-ai.xlsx');
console.log('사용 가능한 시트:', workbook.SheetNames.join(', '));

if (!workbook.SheetNames.includes('Client')) {
  console.log('\n❌ Client 시트가 없습니다!');
  console.log('실제 시트 이름을 확인하세요.');
  process.exit(0);
}

const sheet = workbook.Sheets['Client'];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

console.log(`\n✅ Client 시트 발견!`);
console.log(`총 행 수: ${data.length}행`);

// 1799행 확인 (0-indexed이므로 1798)
console.log('\n📍 1799행 확인:');
const row1799 = data[1798];
if (row1799) {
  console.log(`  N열(인덱스 13): "${row1799[13]}"`);
  console.log(`  전체 행 데이터:`, row1799.slice(0, 20));
} else {
  console.log('  ❌ 1799행이 존재하지 않습니다.');
}

// CL 샤블리 검색
console.log('\n\n🔍 "CL 샤블리" 또는 "샹트 메흘르" 검색:');
let found = 0;

for (let i = 0; i < data.length && found < 10; i++) {
  const row = data[i];
  const rowStr = row.join(' ').toLowerCase();
  
  if (rowStr.includes('cl') && rowStr.includes('샤블리') ||
      rowStr.includes('샹트') && rowStr.includes('메흘르') ||
      rowStr.includes('클레멍') && rowStr.includes('샤블리')) {
    console.log(`\n  행 ${i + 1}:`);
    // 주요 컬럼 출력 (A~P까지)
    row.slice(0, 16).forEach((cell, idx) => {
      if (cell && cell.toString().trim()) {
        const colName = String.fromCharCode(65 + idx);
        console.log(`    ${colName}열: ${cell}`);
      }
    });
    found++;
  }
}

if (found === 0) {
  console.log('  ❌ 관련 데이터를 찾지 못했습니다.');
}

console.log(`\n✅ 총 ${found}건 발견`);
