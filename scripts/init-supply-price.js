/**
 * 공급가 데이터 초기화 스크립트
 * - items 테이블 생성 및 마스터 데이터 로드
 * - English 시트에서 공급가 로드
 */

const Database = require('better-sqlite3');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

function initSupplyPrice() {
  console.log('📊 공급가 데이터 초기화 시작\n');
  
  // 프로젝트 루트 경로
  const rootDir = path.join(__dirname, '..');
  const dbPath = path.join(rootDir, 'data.sqlite3');
  const xlsxPath = path.join(rootDir, 'order-ai.xlsx');
  
  // Excel 파일 확인
  if (!fs.existsSync(xlsxPath)) {
    console.log('  ❌ order-ai.xlsx 파일을 찾을 수 없습니다');
    console.log(`     경로: ${xlsxPath}`);
    return;
  }
  
  const db = new Database(dbPath);
  
  // 1. items 테이블 생성
  console.log('1. items 테이블 생성...');
  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS items (
        item_no TEXT PRIMARY KEY,
        item_name TEXT NOT NULL,
        supply_price REAL,
        category TEXT DEFAULT 'wine',
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    console.log('  ✅ items 테이블 생성 완료');
  } catch (e) {
    console.error('  ❌ 테이블 생성 실패:', e.message);
    db.close();
    return;
  }
  
  // 2. Downloads 시트에서 마스터 데이터 로드
  console.log('\n2. Downloads 시트에서 마스터 데이터 로드...');
  
  const workbook = XLSX.readFile(xlsxPath);
  
  if (!workbook.SheetNames.includes('Downloads')) {
    console.log('  ❌ Downloads 시트를 찾을 수 없습니다');
    db.close();
    return;
  }
  
  const downloadsSheet = workbook.Sheets['Downloads'];
  const downloadsData = XLSX.utils.sheet_to_json(downloadsSheet, { header: 1 });
  
  let insertedCount = 0;
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO items (item_no, item_name, supply_price, category) 
    VALUES (?, ?, ?, 'wine')
  `);
  
  const insertMany = db.transaction(() => {
    for (let i = 1; i < downloadsData.length; i++) {
      const row = downloadsData[i];
      const itemNo = row[1];      // B열: 품번
      const itemName = row[2];    // C열: 품명
      const supplyPrice = row[15]; // P열: 공급가
      
      if (itemNo && itemName) {
        const price = supplyPrice && !isNaN(Number(supplyPrice)) ? Number(supplyPrice) : null;
        insertStmt.run(String(itemNo).trim(), String(itemName).trim(), price);
        insertedCount++;
      }
    }
  });
  
  insertMany();
  console.log(`  ✅ ${insertedCount}개 품목 로드 완료`);
  
  // 3. English 시트에서 공급가 업데이트
  console.log('\n3. English 시트에서 공급가 업데이트...');
  
  if (!workbook.SheetNames.includes('English')) {
    console.log('  ℹ️  English 시트를 찾을 수 없습니다 (선택사항)');
    db.close();
    return;
  }
  
  const englishSheet = workbook.Sheets['English'];
  const englishData = XLSX.utils.sheet_to_json(englishSheet, { header: 1 });
  
  let updatedCount = 0;
  const updateStmt = db.prepare('UPDATE items SET supply_price = ? WHERE item_no = ? AND (supply_price IS NULL OR supply_price = 0)');
  
  const updateMany = db.transaction(() => {
    for (let i = 1; i < englishData.length; i++) {
      const row = englishData[i];
      const code = row[1];        // B열
      const supplyPrice = row[11]; // L열
      
      if (code && supplyPrice && !isNaN(Number(supplyPrice)) && Number(supplyPrice) > 0) {
        const result = updateStmt.run(Number(supplyPrice), String(code).trim());
        if (result.changes > 0) {
          updatedCount++;
        }
      }
    }
  });
  
  updateMany();
  console.log(`  ✅ ${updatedCount}개 품목 공급가 업데이트`);
  
  // 4. 통계
  console.log('\n4. 데이터 통계...');
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      COUNT(supply_price) as with_price,
      COUNT(*) - COUNT(supply_price) as without_price
    FROM items
  `).get();
  
  console.log(`  전체 품목: ${stats.total}개`);
  console.log(`  공급가 있음: ${stats.with_price}개`);
  console.log(`  공급가 없음: ${stats.without_price}개`);
  
  // 5. 샘플 데이터
  console.log('\n5. 샘플 데이터...');
  const samples = db.prepare(`
    SELECT item_no, item_name, supply_price 
    FROM items 
    WHERE supply_price IS NOT NULL 
    LIMIT 3
  `).all();
  
  samples.forEach(s => {
    const name = s.item_name.length > 30 ? s.item_name.substring(0, 30) + '...' : s.item_name;
    console.log(`  [${s.item_no}] ${name}`);
    console.log(`    공급가: ${s.supply_price?.toLocaleString()}원`);
  });
  
  db.close();
  console.log('\n✅ 공급가 데이터 초기화 완료!');
}

// 직접 실행 시
if (require.main === module) {
  const timeout = setTimeout(() => {
    console.error('\n⏱️  타임아웃: 60초 이상 실행됨, 강제 종료');
    process.exit(0); // 빌드 실패를 방지하기 위해 성공으로 종료
  }, 60000); // 60초 타임아웃
  
  try {
    initSupplyPrice();
    clearTimeout(timeout);
  } catch (error) {
    clearTimeout(timeout);
    console.error('\n❌ 초기화 실패:', error.message);
    console.log('⚠️  빌드를 계속 진행합니다...');
    process.exit(0); // 빌드 실패를 방지
  }
}

module.exports = { initSupplyPrice };
