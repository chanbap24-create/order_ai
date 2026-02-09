import { db } from './db';

let initialized = false;

export function ensureWineProfileTable() {
  if (initialized) return;

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

  // inventory 테이블에서 wine_profiles 자동 seed (country 데이터 활용)
  try {
    const count = (db.prepare('SELECT COUNT(*) as cnt FROM wine_profiles').get() as { cnt: number }).cnt;
    if (count === 0) {
      seedFromInventory();
    }
  } catch { /* inventory 테이블이 없을 수 있음 */ }

  initialized = true;
}

function seedFromInventory() {
  // CDV inventory에서 seed
  try {
    db.prepare(`
      INSERT OR IGNORE INTO wine_profiles (item_code, country)
      SELECT item_no, COALESCE(country, '')
      FROM inventory_cdv
      WHERE item_no != '' AND item_no IS NOT NULL
    `).run();
  } catch { /* 테이블 없으면 무시 */ }

  // DL inventory에서 seed
  try {
    db.prepare(`
      INSERT OR IGNORE INTO wine_profiles (item_code, country)
      SELECT item_no, COALESCE(country, '')
      FROM inventory_dl
      WHERE item_no != '' AND item_no IS NOT NULL
    `).run();
  } catch { /* 테이블 없으면 무시 */ }
}
