const Database = require('better-sqlite3');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'data.sqlite3');
const excelPath = path.join(__dirname, '..', 'order-ai.xlsx');

console.log('🔄 Starting inventory sync with new columns...\n');

if (!fs.existsSync(excelPath)) {
  console.error('❌ Excel file not found:', excelPath);
  process.exit(1);
}

const db = new Database(dbPath);
const buffer = fs.readFileSync(excelPath);
const workbook = XLSX.read(buffer, { type: 'buffer' });

// ===== CDV (Downloads) 동기화 =====
console.log('📦 Syncing CDV (Downloads) inventory...');

if (!workbook.SheetNames.includes('Downloads')) {
  console.error('❌ Downloads sheet not found');
  process.exit(1);
}

const downloadsSheet = workbook.Sheets['Downloads'];
const downloadsData = XLSX.utils.sheet_to_json(downloadsSheet, { header: 1 });

// Clear existing data
db.prepare('DELETE FROM inventory_cdv').run();

// Insert CDV data
const insertCDV = db.prepare(`
  INSERT OR REPLACE INTO inventory_cdv (
    item_no, item_name, supply_price, discount_price, wholesale_price, 
    retail_price, min_price, available_stock, bonded_warehouse, 
    incoming_stock, sales_30days, vintage, alcohol_content, country
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let cdvCount = 0;
for (let i = 1; i < downloadsData.length; i++) {
  const row = downloadsData[i];
  const itemNo = String(row[1] || '').trim();
  if (!itemNo) continue;
  
  insertCDV.run(
    itemNo,
    String(row[2] || ''),         // C: 품명
    Number(row[15]) || 0,          // P: 공급가
    Number(row[16]) || 0,          // Q: 할인공급가
    Number(row[17]) || 0,          // R: 도매가
    Number(row[18]) || 0,          // S: 판매가
    Number(row[19]) || 0,          // T: 최저판매가
    Number(row[11]) || 0,          // L: 가용재고
    Number(row[21]) || 0,          // V: 보세창고
    Number(row[20]) || 0,          // U: 미착품
    Number(row[12]) || 0,          // M: 30일출고
    String(row[6] || ''),          // G: 빈티지
    String(row[7] || ''),          // H: 알콜도수
    String(row[8] || '')           // I: 국가
  );
  cdvCount++;
}

console.log(`✅ CDV: ${cdvCount} items synced`);

// Sample data
const cdvSample = db.prepare(`SELECT * FROM inventory_cdv WHERE vintage != '' OR alcohol_content != '' OR country != '' LIMIT 3`).all();
console.log('\n📊 CDV Sample with new columns:');
cdvSample.forEach(item => {
  console.log(`  - [${item.item_no}] ${item.item_name}`);
  console.log(`    빈티지: ${item.vintage || 'N/A'}, 알콜도수: ${item.alcohol_content || 'N/A'}, 국가: ${item.country || 'N/A'}`);
});

// ===== DL (Glass) 동기화 =====
console.log('\n📦 Syncing DL (Glass) inventory...');

if (!workbook.SheetNames.includes('DL')) {
  console.error('❌ DL sheet not found');
  process.exit(1);
}

const dlSheet = workbook.Sheets['DL'];
const dlData = XLSX.utils.sheet_to_json(dlSheet, { header: 1 });

// Clear existing data
db.prepare('DELETE FROM inventory_dl').run();

// Insert DL data
const insertDL = db.prepare(`
  INSERT OR REPLACE INTO inventory_dl (
    item_no, item_name, supply_price, available_stock, anseong_warehouse, 
    sales_30days, vintage, alcohol_content, country
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let dlCount = 0;
for (let i = 1; i < dlData.length; i++) {
  const row = dlData[i];
  const itemNo = String(row[1] || '').trim();
  if (!itemNo) continue;
  
  insertDL.run(
    itemNo,
    String(row[2] || ''),         // C: 품명
    Number(row[15]) || 0,          // P: 공급가
    Number(row[11]) || 0,          // L: 재고
    Number(row[23]) || 0,          // X: 안성창고
    Number(row[12]) || 0,          // M: 30일출고
    String(row[6] || ''),          // G: 빈티지
    String(row[7] || ''),          // H: 알콜도수
    String(row[8] || '')           // I: 국가
  );
  dlCount++;
}

console.log(`✅ DL: ${dlCount} items synced`);

// Sample data
const dlSample = db.prepare(`SELECT * FROM inventory_dl WHERE vintage != '' OR alcohol_content != '' OR country != '' LIMIT 3`).all();
console.log('\n📊 DL Sample with new columns:');
dlSample.forEach(item => {
  console.log(`  - [${item.item_no}] ${item.item_name}`);
  console.log(`    빈티지: ${item.vintage || 'N/A'}, 알콜도수: ${item.alcohol_content || 'N/A'}, 국가: ${item.country || 'N/A'}`);
});

db.close();

console.log('\n✅ Sync completed!');
console.log(`📊 Total: ${cdvCount + dlCount} items (CDV: ${cdvCount}, DL: ${dlCount})`);
