const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data.sqlite3');
const db = new Database(dbPath);

console.log('📊 Adding new columns to inventory tables...\n');

try {
  // inventory_cdv 테이블에 컬럼 추가
  try {
    db.exec('ALTER TABLE inventory_cdv ADD COLUMN vintage TEXT');
    console.log('✅ Added vintage to inventory_cdv');
  } catch (e) {
    if (e.message.includes('duplicate column name')) {
      console.log('ℹ️  vintage column already exists in inventory_cdv');
    } else {
      throw e;
    }
  }
  
  try {
    db.exec('ALTER TABLE inventory_cdv ADD COLUMN alcohol_content TEXT');
    console.log('✅ Added alcohol_content to inventory_cdv');
  } catch (e) {
    if (e.message.includes('duplicate column name')) {
      console.log('ℹ️  alcohol_content column already exists in inventory_cdv');
    } else {
      throw e;
    }
  }
  
  try {
    db.exec('ALTER TABLE inventory_cdv ADD COLUMN country TEXT');
    console.log('✅ Added country to inventory_cdv');
  } catch (e) {
    if (e.message.includes('duplicate column name')) {
      console.log('ℹ️  country column already exists in inventory_cdv');
    } else {
      throw e;
    }
  }

  console.log('\n📊 Adding columns to inventory_dl...\n');

  // inventory_dl 테이블에도 추가
  try {
    db.exec('ALTER TABLE inventory_dl ADD COLUMN vintage TEXT');
    console.log('✅ Added vintage to inventory_dl');
  } catch (e) {
    if (e.message.includes('duplicate column name')) {
      console.log('ℹ️  vintage column already exists in inventory_dl');
    } else {
      throw e;
    }
  }
  
  try {
    db.exec('ALTER TABLE inventory_dl ADD COLUMN alcohol_content TEXT');
    console.log('✅ Added alcohol_content to inventory_dl');
  } catch (e) {
    if (e.message.includes('duplicate column name')) {
      console.log('ℹ️  alcohol_content column already exists in inventory_dl');
    } else {
      throw e;
    }
  }
  
  try {
    db.exec('ALTER TABLE inventory_dl ADD COLUMN country TEXT');
    console.log('✅ Added country to inventory_dl');
  } catch (e) {
    if (e.message.includes('duplicate column name')) {
      console.log('ℹ️  country column already exists in inventory_dl');
    } else {
      throw e;
    }
  }

  console.log('\n✅ All columns added successfully!');
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
} finally {
  db.close();
}
