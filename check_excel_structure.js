const XLSX = require('xlsx');

const workbook = XLSX.readFile('order-ai.xlsx');
const sheet = workbook.Sheets['English'];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('=== 첫 5개 행 확인 ===\n');

for (let i = 0; i < Math.min(5, data.length); i++) {
  const row = data[i];
  console.log(`행 ${i}:`);
  console.log(`  전체 컬럼 수: ${row.length}`);
  
  // A부터 N까지 (0-13)
  const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];
  for (let j = 0; j < Math.min(14, row.length); j++) {
    if (row[j]) {
      console.log(`  ${cols[j]}(${j}): ${row[j]}`);
    }
  }
  console.log();
}

