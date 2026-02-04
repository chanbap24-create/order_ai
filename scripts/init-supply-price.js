/**
 * 공급가 데이터 초기화 스크립트
 * - items 테이블에 supply_price 컬럼 추가
 * - English 시트에서 공급가 로드
 */

const Database = require('better-sqlite3');
const XLSX = require('xlsx');
const path = require('path');

function initSupplyPrice() {
  console.log('📊 공급가 데이터 초기화 시작\n');
  
  const db = new Database(path.join(__dirname, 'data.sqlite3'));
  
  // 1. supply_price 컬럼 추가
  console.log('1. items 테이블에 supply_price 컬럼 추가...');
  try {
    db.prepare('ALTER TABLE items ADD COLUMN supply_price REAL').run();
    console.log('  ✅ supply_price 컬럼 추가 완료');
  } catch (e) {
    if (e.message.includes('duplicate column')) {
      console.log('  ℹ️  supply_price 컬럼이 이미 존재합니다');
    } else {
      console.error('  ❌ 에러:', e.message);
    }
  }
  
  try {
    db.prepare('ALTER TABLE items ADD COLUMN category TEXT').run();
    console.log('  ✅ category 컬럼 추가 완료');
  } catch (e) {
    if (e.message.includes('duplicate column')) {
      console.log('  ℹ️  category 컬럼이 이미 존재합니다');
    }
  }
  
  // 2. English 시트에서 공급가 로드
  console.log('\n2. English 시트에서 공급가 로드...');
  
  const xlsxPath = path.join(__dirname, 'order-ai.xlsx');
  const workbook = XLSX.readFile(xlsxPath);
  
  if (!workbook.SheetNames.includes('English')) {
    console.log('  ❌ English 시트를 찾을 수 없습니다');
    db.close();
    return;
  }
  
  const sheet = workbook.Sheets['English'];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  let updatedCount = 0;
  let notFoundCount = 0;
  
  const updateStmt = db.prepare('UPDATE items SET supply_price = ? WHERE item_no = ?');
  const updateMany = db.transaction(() => {
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const code = row[1];        // B열
      const supplyPrice = row[11]; // L열
      
      if (code && supplyPrice && !isNaN(Number(supplyPrice))) {
        const result = updateStmt.run(Number(supplyPrice), String(code).trim());
        
        if (result.changes > 0) {
          updatedCount++;
        } else {
          notFoundCount++;
        }
      }
    }
  });
  
  updateMany();
  
  console.log(`  ✅ 공급가 업데이트 완료:`);
  console.log(`     - 업데이트됨: ${updatedCount}개`);
  console.log(`     - 찾을 수 없음: ${notFoundCount}개`);
  
  // 3. 확인
  console.log('\n3. 샘플 데이터 확인...');
  const samples = db.prepare(`
    SELECT item_no, item_name, supply_price 
    FROM items 
    WHERE supply_price IS NOT NULL 
    LIMIT 3
  `).all();
  
  samples.forEach(s => {
    console.log(`  [${s.item_no}] ${s.item_name.substring(0, 30)}...`);
    console.log(`    공급가: ${s.supply_price?.toLocaleString()}원`);
  });
  
  db.close();
  console.log('\n✅ 공급가 데이터 초기화 완료!');
}

// 직접 실행 시
if (require.main === module) {
  initSupplyPrice();
}

module.exports = { initSupplyPrice };
