const XLSX = require('xlsx');
const workbook = XLSX.readFile('./order-ai.xlsx');
const sheet = workbook.Sheets['English'];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

console.log('=== 2418531 검색 (모든 열) ===');
let found = false;
for (let i = 0; i < data.length; i++) {
  const row = data[i];
  for (let j = 0; j < row.length; j++) {
    if (String(row[j]).includes('2418531')) {
      console.log(`✅ 발견! 행 ${i}, 열 ${j}`);
      console.log('해당 행:', row);
      found = true;
      break;
    }
  }
  if (found) break;
}

if (!found) {
  console.log('❌ 2418531을 English 시트에서 찾을 수 없습니다!');
  console.log('\n=== Client 시트에서 검색 ===');
  
  const clientSheet = workbook.Sheets['Client'];
  const clientData = XLSX.utils.sheet_to_json(clientSheet, { header: 1, defval: '' });
  
  for (let i = 0; i < Math.min(clientData.length, 2000); i++) {
    const row = clientData[i];
    if (String(row[12]).includes('2418531')) {
      console.log(`✅ Client 시트에서 발견! 행 ${i}`);
      console.log('품번(M):', row[12]);
      console.log('품목명(N):', row[13]);
      break;
    }
  }
}
