// 와인 관리 시스템 DB 테이블 및 CRUD

import { db } from "@/app/lib/db";
import { logger } from "@/app/lib/logger";
import { getCountryPair } from "@/app/lib/countryMapping";
import type { Wine, TastingNote, AdminSetting } from "@/app/types/wine";

/* ─── 테이블 생성 ─── */

export function ensureWineTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS wines (
      item_code TEXT PRIMARY KEY,
      item_name_kr TEXT NOT NULL,
      item_name_en TEXT,
      country TEXT,
      country_en TEXT,
      region TEXT,
      grape_varieties TEXT,
      wine_type TEXT,
      vintage TEXT,
      volume_ml INTEGER,
      alcohol TEXT,
      supplier TEXT,
      supplier_kr TEXT,
      supply_price REAL,
      available_stock REAL,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','new','discontinued')),
      ai_researched INTEGER DEFAULT 0,
      image_url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasting_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wine_id TEXT NOT NULL UNIQUE,
      color_note TEXT,
      nose_note TEXT,
      palate_note TEXT,
      food_pairing TEXT,
      glass_pairing TEXT,
      serving_temp TEXT,
      awards TEXT,
      winemaking TEXT,
      winery_description TEXT,
      vintage_note TEXT,
      aging_potential TEXT,
      ai_generated INTEGER DEFAULT 0,
      manually_edited INTEGER DEFAULT 0,
      approved INTEGER DEFAULT 0,
      ppt_generated INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (wine_id) REFERENCES wines(item_code)
    );

    CREATE TABLE IF NOT EXISTS wine_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wine_id TEXT NOT NULL,
      image_type TEXT,
      file_path TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (wine_id) REFERENCES wines(item_code)
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_code TEXT NOT NULL,
      field_name TEXT DEFAULT 'supply_price',
      old_value REAL,
      new_value REAL,
      change_pct REAL,
      detected_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS change_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admin_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 기본 설정값
  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO admin_settings (key, value) VALUES (?, ?)
  `);
  insertSetting.run('low_stock_threshold', '6');

  // 기존 DB 마이그레이션: tasting_notes에 새 컬럼 추가
  const newColumns = [
    { name: 'winery_description', type: 'TEXT' },
    { name: 'vintage_note', type: 'TEXT' },
    { name: 'aging_potential', type: 'TEXT' },
    { name: 'ai_generated', type: 'INTEGER DEFAULT 0' },
    { name: 'manually_edited', type: 'INTEGER DEFAULT 0' },
    { name: 'approved', type: 'INTEGER DEFAULT 0' },
  ];
  for (const col of newColumns) {
    try {
      db.exec(`ALTER TABLE tasting_notes ADD COLUMN ${col.name} ${col.type}`);
    } catch { /* 이미 존재하면 무시 */ }
  }

  logger.info("Wine management tables ensured");
}

/* ─── Wines CRUD ─── */

export function getWines(filters?: { status?: string; search?: string; country?: string }): Wine[] {
  ensureWineTables();
  let sql = 'SELECT * FROM wines WHERE 1=1';
  const params: unknown[] = [];

  if (filters?.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters?.search) {
    sql += ' AND (item_name_kr LIKE ? OR item_name_en LIKE ? OR item_code LIKE ?)';
    const term = `%${filters.search}%`;
    params.push(term, term, term);
  }
  if (filters?.country) {
    sql += ' AND (country = ? OR country_en = ?)';
    params.push(filters.country, filters.country);
  }

  sql += ' ORDER BY updated_at DESC';
  return db.prepare(sql).all(...params) as Wine[];
}

export function getWineByCode(itemCode: string): Wine | undefined {
  ensureWineTables();
  return db.prepare('SELECT * FROM wines WHERE item_code = ?').get(itemCode) as Wine | undefined;
}

export function upsertWine(wine: Partial<Wine> & { item_code: string }) {
  ensureWineTables();
  const existing = getWineByCode(wine.item_code);

  if (existing) {
    const fields: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(wine)) {
      if (key === 'item_code' || key === 'created_at') continue;
      fields.push(`${key} = ?`);
      values.push(value);
    }
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(wine.item_code);

    db.prepare(`UPDATE wines SET ${fields.join(', ')} WHERE item_code = ?`).run(...values);
  } else {
    const cols = Object.keys(wine);
    const placeholders = cols.map(() => '?').join(', ');
    const values = cols.map((k) => (wine as Record<string, unknown>)[k]);
    db.prepare(`INSERT INTO wines (${cols.join(', ')}) VALUES (${placeholders})`).run(...values);
  }
}

export function deleteWine(itemCode: string) {
  ensureWineTables();
  db.prepare('DELETE FROM tasting_notes WHERE wine_id = ?').run(itemCode);
  db.prepare('DELETE FROM wine_images WHERE wine_id = ?').run(itemCode);
  db.prepare('DELETE FROM wines WHERE item_code = ?').run(itemCode);
}

/* ─── Tasting Notes CRUD ─── */

export function getTastingNote(wineId: string): TastingNote | undefined {
  ensureWineTables();
  return db.prepare('SELECT * FROM tasting_notes WHERE wine_id = ?').get(wineId) as TastingNote | undefined;
}

export function getTastingNotes(filters?: { search?: string; country?: string; hasNote?: boolean }): (Wine & { tasting_note_id: number | null })[] {
  ensureWineTables();
  let sql = `
    SELECT w.*, tn.id as tasting_note_id
    FROM wines w
    LEFT JOIN tasting_notes tn ON w.item_code = tn.wine_id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (filters?.search) {
    sql += ' AND (w.item_name_kr LIKE ? OR w.item_name_en LIKE ?)';
    const term = `%${filters.search}%`;
    params.push(term, term);
  }
  if (filters?.country) {
    sql += ' AND (w.country = ? OR w.country_en = ?)';
    params.push(filters.country, filters.country);
  }
  if (filters?.hasNote === true) {
    sql += ' AND tn.id IS NOT NULL';
  } else if (filters?.hasNote === false) {
    sql += ' AND tn.id IS NULL';
  }

  sql += ' ORDER BY w.updated_at DESC';
  return db.prepare(sql).all(...params) as (Wine & { tasting_note_id: number | null })[];
}

export function upsertTastingNote(wineId: string, note: Partial<TastingNote>) {
  ensureWineTables();
  const existing = getTastingNote(wineId);

  if (existing) {
    const fields: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(note)) {
      if (key === 'id' || key === 'wine_id' || key === 'created_at') continue;
      fields.push(`${key} = ?`);
      values.push(value);
    }
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(wineId);

    db.prepare(`UPDATE tasting_notes SET ${fields.join(', ')} WHERE wine_id = ?`).run(...values);
  } else {
    db.prepare(`
      INSERT INTO tasting_notes (wine_id, color_note, nose_note, palate_note, food_pairing, glass_pairing, serving_temp, awards, winemaking, winery_description, vintage_note, aging_potential, ai_generated, manually_edited, approved)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      wineId,
      note.color_note || null,
      note.nose_note || null,
      note.palate_note || null,
      note.food_pairing || null,
      note.glass_pairing || null,
      note.serving_temp || null,
      note.awards || null,
      note.winemaking || null,
      note.winery_description || null,
      note.vintage_note || null,
      note.aging_potential || null,
      note.ai_generated || 0,
      note.manually_edited || 0,
      note.approved || 0
    );
  }
}

/* ─── Admin Settings ─── */

export function getSetting(key: string): string | undefined {
  ensureWineTables();
  const row = db.prepare('SELECT value FROM admin_settings WHERE key = ?').get(key) as AdminSetting | undefined;
  return row?.value;
}

export function setSetting(key: string, value: string) {
  ensureWineTables();
  db.prepare(`
    INSERT INTO admin_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(key, value);
}

/* ─── Statistics ─── */

export function getWineStats() {
  ensureWineTables();
  const threshold = parseInt(getSetting('low_stock_threshold') || '6', 10);

  const totalWines = (db.prepare('SELECT COUNT(*) as cnt FROM wines').get() as { cnt: number }).cnt;
  const newWines = (db.prepare("SELECT COUNT(*) as cnt FROM wines WHERE status = 'new'").get() as { cnt: number }).cnt;
  const lowStock = (db.prepare('SELECT COUNT(*) as cnt FROM wines WHERE available_stock IS NOT NULL AND available_stock > 0 AND available_stock <= ?').get(threshold) as { cnt: number }).cnt;
  const priceChanges = (db.prepare("SELECT COUNT(*) as cnt FROM price_history WHERE detected_at > datetime('now', '-30 days')").get() as { cnt: number }).cnt;

  const tnTotal = (db.prepare('SELECT COUNT(*) as cnt FROM wines WHERE status != ?').get('discontinued') as { cnt: number }).cnt;
  const tnComplete = (db.prepare('SELECT COUNT(*) as cnt FROM tasting_notes WHERE color_note IS NOT NULL').get() as { cnt: number }).cnt;

  return {
    totalWines,
    newWines,
    lowStock,
    priceChanges,
    tastingNotesComplete: tnComplete,
    tastingNotesTotal: tnTotal,
  };
}

/* ─── New Wines with Status ─── */

export interface WineWithStatus extends Wine {
  tasting_note_id: number | null;
  ai_generated: number;
  approved: number;
  wine_status: 'detected' | 'researched' | 'approved';
}

export function getNewWinesWithStatus(filters?: { status?: string; search?: string; wineStatus?: string }): WineWithStatus[] {
  ensureWineTables();
  let sql = `
    SELECT w.*, tn.id as tasting_note_id,
      COALESCE(tn.ai_generated, 0) as ai_generated,
      COALESCE(tn.approved, 0) as approved,
      CASE
        WHEN tn.approved = 1 THEN 'approved'
        WHEN tn.ai_generated = 1 OR w.ai_researched = 1 THEN 'researched'
        ELSE 'detected'
      END as wine_status
    FROM wines w
    LEFT JOIN tasting_notes tn ON w.item_code = tn.wine_id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (filters?.status) {
    sql += ' AND w.status = ?';
    params.push(filters.status);
  }
  if (filters?.search) {
    sql += ' AND (w.item_name_kr LIKE ? OR w.item_name_en LIKE ? OR w.item_code LIKE ?)';
    const term = `%${filters.search}%`;
    params.push(term, term, term);
  }
  if (filters?.wineStatus === 'detected') {
    sql += ' AND (tn.ai_generated IS NULL OR tn.ai_generated = 0) AND (w.ai_researched = 0 OR w.ai_researched IS NULL)';
  } else if (filters?.wineStatus === 'researched') {
    sql += ' AND (tn.ai_generated = 1 OR w.ai_researched = 1) AND (tn.approved IS NULL OR tn.approved = 0)';
  } else if (filters?.wineStatus === 'approved') {
    sql += ' AND tn.approved = 1';
  }

  sql += ' ORDER BY w.updated_at DESC';
  return db.prepare(sql).all(...params) as WineWithStatus[];
}

/* ─── Price List ─── */

export function getWinesForPriceList(): Wine[] {
  ensureWineTables();
  return db.prepare(`
    SELECT * FROM wines
    WHERE status != 'discontinued'
    ORDER BY country_en ASC, supplier ASC, supply_price DESC
  `).all() as Wine[];
}
