const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || './data.sqlite3';
const db = new Database(DB_PATH);

console.log('Creating inventory table...');

try {
  // Drop existing table if it exists
  db.exec('DROP TABLE IF EXISTS inventory');
  
  // Create inventory table
  db.exec(`
    CREATE TABLE inventory (
      item_no TEXT PRIMARY KEY,
      item_name TEXT NOT NULL,
      available_stock INTEGER DEFAULT 0,
      bonded_warehouse INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  console.log('✅ Inventory table created successfully!');
  
  // Show table structure
  const tableInfo = db.prepare('PRAGMA table_info(inventory)').all();
  console.log('\n=== Inventory Table Structure ===');
  tableInfo.forEach(col => {
    console.log(`${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}${col.pk ? ' PRIMARY KEY' : ''}`);
  });
  
} catch (error) {
  console.error('❌ Error creating inventory table:', error.message);
  process.exit(1);
} finally {
  db.close();
}
