// app/lib/syncFromXlsx.ts
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { db } from "@/app/lib/db";
import { config } from "@/app/lib/config";

/**
 * order-ai.xlsx / Client 시트
 * E=거래처명, F=거래처코드, M=품목번호, N=품목명, T=공급가
 */
const XLSX_PATH = config.excel.path 
  ? (path.isAbsolute(config.excel.path) ? config.excel.path : path.join(process.cwd(), config.excel.path))
  : path.join(process.cwd(), "order-ai.xlsx");

// 파일이 바뀐 경우에만 동기화(가볍게)
let lastMtimeMs = 0;

function ensureTables() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS clients (
      client_code TEXT PRIMARY KEY,
      client_name TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS client_alias (
      client_code TEXT NOT NULL,
      alias TEXT NOT NULL,
      weight INTEGER DEFAULT 1,
      PRIMARY KEY (client_code, alias)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS client_item_stats (
      client_code TEXT NOT NULL,
      item_no TEXT NOT NULL,
      item_name TEXT NOT NULL,
      supply_price REAL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (client_code, item_no)
    )
  `).run();

  db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_client_item_stats_client ON client_item_stats(client_code)`
  ).run();

  // item_alias 테이블 생성 (별칭 시스템)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS item_alias (
      alias TEXT PRIMARY KEY,
      canonical TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      count INTEGER DEFAULT 1,
      last_used_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

function normCode(x: any) {
  return String(x ?? "").trim().replace(/\.0$/, "");
}
function normText(x: any) {
  return String(x ?? "").trim();
}
function toNumber(x: any) {
  if (x == null) return null;
  const s = String(x).replace(/,/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function syncFromXlsxIfNeeded() {
  try {
    if (!fs.existsSync(XLSX_PATH)) {
      return { synced: false, reason: "xlsx_not_found" as const, xlsxPath: XLSX_PATH };
    }

    const stat = fs.statSync(XLSX_PATH);
    // ✅ DB에 데이터가 있는지 확인 (Vercel 서버리스 대응)
    const itemCount = db.prepare("SELECT COUNT(*) as count FROM client_item_stats").get() as { count: number };
    const hasData = itemCount && itemCount.count > 0;
    
    if (lastMtimeMs && stat.mtimeMs === lastMtimeMs && hasData) {
      return { synced: false, reason: "not_changed" as const };
    }

    ensureTables();

    // ✅ 핵심: "파일 경로로 열기" 대신 "Buffer로 읽어서" 파싱
    // 윈도우/백신/권한 이슈로 tmp 파일 열기 실패를 회피
    const buf = fs.readFileSync(XLSX_PATH);
    const wb = XLSX.read(buf, { type: "buffer", cellDates: true });

    const ws = wb.Sheets["Client"];
    if (!ws) return { synced: false, reason: "sheet_not_found" as const };

    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" });

    // 0-based index: E=4, F=5, M=12, N=13, T=19
    const IDX_CLIENT_NAME = 4;
    const IDX_CLIENT_CODE = 5;
    const IDX_ITEM_NO = 12;
    const IDX_ITEM_NAME = 13;
    const IDX_SUPPLY_PRICE = 19;

    const clientMap = new Map<string, string>(); // code -> name
    const itemMap = new Map<
      string,
      { client_code: string; item_no: string; item_name: string; supply_price: number | null }
    >();

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i] || [];
      const client_name = normText(r[IDX_CLIENT_NAME]);
      const client_code = normCode(r[IDX_CLIENT_CODE]);
      if (!client_name || !client_code) continue;

      clientMap.set(client_code, client_name);

      const item_no = normCode(r[IDX_ITEM_NO]);
      const item_name = normText(r[IDX_ITEM_NAME]);
      if (!item_no || !item_name) continue;

      const supply_price = toNumber(r[IDX_SUPPLY_PRICE]);
      itemMap.set(`${client_code}||${item_no}`, {
        client_code,
        item_no,
        item_name,
        supply_price,
      });
    }

    const upsertClient = db.prepare(`
      INSERT INTO clients (client_code, client_name, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(client_code) DO UPDATE SET
        client_name = excluded.client_name,
        updated_at = CURRENT_TIMESTAMP
    `);

    const upsertAlias = db.prepare(`
      INSERT INTO client_alias (client_code, alias, weight)
      VALUES (?, ?, 10)
      ON CONFLICT(client_code, alias) DO UPDATE SET
        weight = CASE WHEN client_alias.weight < 10 THEN 10 ELSE client_alias.weight END
    `);

    const upsertItem = db.prepare(`
      INSERT INTO client_item_stats (client_code, item_no, item_name, supply_price, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(client_code, item_no) DO UPDATE SET
        item_name = excluded.item_name,
        supply_price = excluded.supply_price,
        updated_at = CURRENT_TIMESTAMP
    `);

    db.transaction(() => {
      for (const [code, name] of clientMap.entries()) {
        upsertClient.run(code, name);
        upsertAlias.run(code, name);
      }
      for (const v of itemMap.values()) {
        upsertItem.run(v.client_code, v.item_no, v.item_name, v.supply_price);
      }
    })();

    lastMtimeMs = stat.mtimeMs;

    return { synced: true, clients: clientMap.size, items: itemMap.size };
  } catch (e: any) {
    const msg = String(e?.message || e);
    return { synced: false, reason: "sync_error" as const, error: msg, xlsxPath: XLSX_PATH };
  }
}

/* ==================== Glass(DL-Client) 테이블 동기화 ==================== */
let lastGlassMtimeMs = 0;

function ensureGlassTables() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS glass_clients (
      client_code TEXT PRIMARY KEY,
      client_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS glass_client_alias (
      client_code TEXT NOT NULL,
      alias TEXT NOT NULL,
      weight INTEGER DEFAULT 10,
      PRIMARY KEY (client_code, alias)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS glass_items (
      item_no TEXT PRIMARY KEY,
      item_name TEXT NOT NULL,
      supply_price REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS glass_client_item_stats (
      client_code TEXT NOT NULL,
      item_no TEXT NOT NULL,
      item_name TEXT NOT NULL,
      supply_price REAL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (client_code, item_no)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS glass_item_synonyms (
      input_text TEXT NOT NULL,
      item_no TEXT NOT NULL,
      canonical_name TEXT NOT NULL,
      learned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (input_text, item_no)
    )
  `).run();

  db.prepare(`CREATE INDEX IF NOT EXISTS idx_glass_client_alias_alias ON glass_client_alias(alias)`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_glass_items_name ON glass_items(item_name)`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_glass_client_item_stats_client ON glass_client_item_stats(client_code)`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_glass_item_synonyms_input ON glass_item_synonyms(input_text)`).run();
}

/**
 * order-ai.xlsx / DL-Client 시트에서 Glass 테이블 동기화
 * E(4)=거래처명, F(5)=거래처코드, M(12)=품목번호, N(13)=품목명, Q(16)=공급가
 */
export function syncGlassFromXlsxIfNeeded() {
  try {
    if (!fs.existsSync(XLSX_PATH)) {
      return { synced: false, reason: "xlsx_not_found" as const, xlsxPath: XLSX_PATH };
    }

    const stat = fs.statSync(XLSX_PATH);

    // DB에 glass 데이터가 있는지 확인
    ensureGlassTables();
    const glassCount = db.prepare("SELECT COUNT(*) as count FROM glass_items").get() as { count: number };
    const hasData = glassCount && glassCount.count > 0;

    if (lastGlassMtimeMs && stat.mtimeMs === lastGlassMtimeMs && hasData) {
      return { synced: false, reason: "not_changed" as const };
    }

    const buf = fs.readFileSync(XLSX_PATH);
    const wb = XLSX.read(buf, { type: "buffer", cellDates: true });

    const ws = wb.Sheets["DL-Client"];
    if (!ws) return { synced: false, reason: "dl_client_sheet_not_found" as const };

    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" });

    // DL-Client 시트 컬럼: E(4)=거래처명, F(5)=거래처코드, M(12)=품목번호, N(13)=품목명, Q(16)=공급가
    const IDX_GL_CLIENT_NAME = 4;
    const IDX_GL_CLIENT_CODE = 5;
    const IDX_GL_ITEM_NO = 12;
    const IDX_GL_ITEM_NAME = 13;
    const IDX_GL_PRICE = 16;

    const clientsMap = new Map<string, string>();
    const itemsMap = new Map<string, string>();
    const clientItemsMap = new Map<string, { clientCode: string; itemNo: string; itemName: string; price: number }>();

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i] || [];
      const clientName = normText(r[IDX_GL_CLIENT_NAME]);
      const clientCode = normCode(r[IDX_GL_CLIENT_CODE]);
      const itemNo = normCode(r[IDX_GL_ITEM_NO]);
      const itemName = normText(r[IDX_GL_ITEM_NAME]);
      const price = parseFloat(r[IDX_GL_PRICE]) || 0;

      if (!clientCode || !itemNo || !clientName || !itemName) continue;

      if (!clientsMap.has(clientCode)) {
        clientsMap.set(clientCode, clientName);
      }
      if (!itemsMap.has(itemNo)) {
        itemsMap.set(itemNo, itemName);
      }
      const key = `${clientCode}:${itemNo}`;
      if (!clientItemsMap.has(key)) {
        clientItemsMap.set(key, { clientCode, itemNo, itemName, price });
      }
    }

    const upsertGlassClient = db.prepare(`
      INSERT INTO glass_clients (client_code, client_name)
      VALUES (?, ?)
      ON CONFLICT(client_code) DO UPDATE SET client_name = excluded.client_name
    `);

    const upsertGlassAlias = db.prepare(`
      INSERT INTO glass_client_alias (client_code, alias, weight)
      VALUES (?, ?, 10)
      ON CONFLICT(client_code, alias) DO UPDATE SET
        weight = CASE WHEN glass_client_alias.weight < 10 THEN 10 ELSE glass_client_alias.weight END
    `);

    const upsertGlassItem = db.prepare(`
      INSERT INTO glass_items (item_no, item_name, supply_price, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(item_no) DO UPDATE SET
        item_name = excluded.item_name,
        supply_price = excluded.supply_price,
        updated_at = CURRENT_TIMESTAMP
    `);

    const upsertGlassClientItem = db.prepare(`
      INSERT INTO glass_client_item_stats (client_code, item_no, item_name, supply_price, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(client_code, item_no) DO UPDATE SET
        item_name = excluded.item_name,
        supply_price = excluded.supply_price,
        updated_at = CURRENT_TIMESTAMP
    `);

    db.transaction(() => {
      for (const [code, name] of clientsMap.entries()) {
        upsertGlassClient.run(code, name);
        upsertGlassAlias.run(code, name);
      }
      for (const [no, name] of itemsMap.entries()) {
        upsertGlassItem.run(no, name, 0);
      }
      for (const item of clientItemsMap.values()) {
        upsertGlassClientItem.run(item.clientCode, item.itemNo, item.itemName, item.price);
      }
    })();

    lastGlassMtimeMs = stat.mtimeMs;

    console.log(`[Glass Sync] 거래처: ${clientsMap.size}, 품목: ${itemsMap.size}, 거래처별품목: ${clientItemsMap.size}`);
    return { synced: true, clients: clientsMap.size, items: itemsMap.size, clientItems: clientItemsMap.size };
  } catch (e: any) {
    const msg = String(e?.message || e);
    console.error("[Glass Sync Error]", msg);
    return { synced: false, reason: "sync_error" as const, error: msg };
  }
}
