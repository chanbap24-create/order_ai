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

  initialized = true;
}
