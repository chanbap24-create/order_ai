const XLSX = require('xlsx');
const Database = require('better-sqlite3');
const path = require('path');

const XLSX_PATH = process.env.ORDER_AI_XLSX_PATH || './order-ai.xlsx';
const DB_PATH = process.env.DB_PATH || './data.sqlite3';

console.log('🚀 Starting inventory synchronization...\n');

try {
  // Read Excel file
  console.log('📖 Reading Excel file:', XLSX_PATH);
  const workbook = XLSX.readFile(XLSX_PATH);
  
  if (!workbook.SheetNames.includes('Downloads')) {
    throw new Error('Downloads sheet not found in Excel file');
  }
  
  const sheet = workbook.Sheets['Downloads'];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  console.log(`✅ Found ${data.length} rows in Downloads sheet\n`);
  
  // Open database
  const db = new Database(DB_PATH);
  
  // Clear existing data
  console.log('🗑️  Clearing existing inventory data...');
  db.exec('DELETE FROM inventory');
  
  // Prepare insert statement
  const insertStmt = db.prepare(`
    INSERT INTO inventory (item_no, item_name, available_stock, bonded_warehouse, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `);
  
  // Process data (skip header row)
  let successCount = 0;
  let errorCount = 0;
  
  const insertMany = db.transaction((rows) => {
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      // B열 = 품목번호 (index 1)
      // C열 = 품목명 (index 2)
      // L열 = 가용재고 (index 11)
      // V열 = 보세창고 (index 21)
      const itemNo = row[1];
      const itemName = row[2];
      const availableStock = row[11] || 0;
      const bondedWarehouse = row[21] || 0;
      
      // Skip if no item number or name
      if (!itemNo || !itemName) {
        continue;
      }
      
      try {
        insertStmt.run(
          String(itemNo).trim(),
          String(itemName).trim(),
          Number(availableStock),
          Number(bondedWarehouse)
        );
        successCount++;
      } catch (error) {
        errorCount++;
        console.error(`❌ Error inserting row ${i}: ${error.message}`);
      }
    }
  });
  
  console.log('💾 Inserting data into database...');
  insertMany(data);
  
  db.close();
  
  console.log('\n✅ Synchronization completed!');
  console.log(`   - Successfully inserted: ${successCount} items`);
  console.log(`   - Errors: ${errorCount}`);
  
  // Show sample data
  const dbRead = new Database(DB_PATH, { readonly: true });
  const samples = dbRead.prepare('SELECT * FROM inventory LIMIT 5').all();
  
  console.log('\n📊 Sample data:');
  samples.forEach(item => {
    console.log(`   ${item.item_no} | ${item.item_name} | 가용: ${item.available_stock} | 보세: ${item.bonded_warehouse}`);
  });
  
  const total = dbRead.prepare('SELECT COUNT(*) as count FROM inventory').get();
  console.log(`\n📈 Total inventory items: ${total.count}`);
  
  dbRead.close();
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
}
