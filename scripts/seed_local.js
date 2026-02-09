const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '..', 'data.sqlite3'));

// 테이블 생성
db.prepare(`
  CREATE TABLE IF NOT EXISTS wine_profiles (
    item_code TEXT PRIMARY KEY,
    country TEXT DEFAULT '',
    region TEXT DEFAULT '',
    sub_region TEXT DEFAULT '',
    appellation TEXT DEFAULT '',
    grape_varieties TEXT DEFAULT '',
    wine_type TEXT DEFAULT '',
    body TEXT DEFAULT '',
    sweetness TEXT DEFAULT '',
    tasting_aroma TEXT DEFAULT '',
    tasting_palate TEXT DEFAULT '',
    food_pairing TEXT DEFAULT '',
    description_kr TEXT DEFAULT '',
    description_en TEXT DEFAULT '',
    alcohol TEXT DEFAULT '',
    serving_temp TEXT DEFAULT '',
    aging_potential TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`).run();

db.prepare('CREATE INDEX IF NOT EXISTS idx_wp_country ON wine_profiles(country)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_wp_wine_type ON wine_profiles(wine_type)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_wp_region ON wine_profiles(region)').run();

// inventory seed
try {
  const r1 = db.prepare(`INSERT OR IGNORE INTO wine_profiles (item_code, country)
    SELECT item_no, COALESCE(country, '') FROM inventory_cdv WHERE item_no != '' AND item_no IS NOT NULL`).run();
  console.log('CDV seeded:', r1.changes);
} catch(e) { console.log('CDV seed error:', e.message); }

try {
  const r2 = db.prepare(`INSERT OR IGNORE INTO wine_profiles (item_code, country)
    SELECT item_no, COALESCE(country, '') FROM inventory_dl WHERE item_no != '' AND item_no IS NOT NULL`).run();
  console.log('DL seeded:', r2.changes);
} catch(e) { console.log('DL seed error:', e.message); }

const total = db.prepare('SELECT COUNT(*) as cnt FROM wine_profiles').get();
console.log('Total profiles:', total.cnt);

// quote_items에 있는 품목코드 확인
try {
  const quoteItems = db.prepare('SELECT item_code FROM quote_items').all();
  console.log('\nQuote items:', quoteItems.length);
  for (const qi of quoteItems) {
    const wp = db.prepare('SELECT item_code, grape_varieties, description_kr FROM wine_profiles WHERE item_code = ?').get(qi.item_code);
    console.log(' ', qi.item_code, '->', wp ? `grape: [${wp.grape_varieties}] desc: [${(wp.description_kr||'').substring(0,30)}]` : 'NOT FOUND');
  }
} catch(e) { console.log('Quote check error:', e.message); }

db.close();
