import { db } from './db';

let initialized = false;

export function ensureQuoteTable() {
  if (initialized) return;

  db.prepare(`
    CREATE TABLE IF NOT EXISTS quote_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_code TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT '',
      brand TEXT NOT NULL DEFAULT '',
      region TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      vintage TEXT NOT NULL DEFAULT '',
      product_name TEXT NOT NULL DEFAULT '',
      supply_price REAL NOT NULL DEFAULT 0,
      retail_price REAL NOT NULL DEFAULT 0,
      discount_rate REAL NOT NULL DEFAULT 0,
      discounted_price REAL NOT NULL DEFAULT 0,
      quantity INTEGER NOT NULL DEFAULT 1,
      note TEXT NOT NULL DEFAULT '',
      tasting_note TEXT NOT NULL DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_quote_items_item_code ON quote_items(item_code)'
  ).run();

  // retail_price 컬럼이 없으면 추가 (기존 테이블 마이그레이션)
  try {
    const cols = db.prepare('PRAGMA table_info(quote_items)').all() as Array<{ name: string }>;
    if (!cols.find(c => c.name === 'retail_price')) {
      db.prepare('ALTER TABLE quote_items ADD COLUMN retail_price REAL NOT NULL DEFAULT 0').run();
    }
  } catch { /* already exists */ }

  initialized = true;
}
