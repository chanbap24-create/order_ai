// sync_excel_to_db.js
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const Database = require("better-sqlite3");

const XLSX_PATH = path.join(__dirname, "order-ai.xlsx");
const DB_PATH = path.join(__dirname, "data.sqlite3");

function ensureTables(db) {
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
}

function normCode(x) {
  return String(x ?? "").trim().replace(/\.0$/, "");
}

function normText(x) {
  return String(x ?? "").trim();
}

function toNumber(x) {
  if (x == null) return null;
  const s = String(x).replace(/,/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function syncFromXlsx() {
  try {
    if (!fs.existsSync(XLSX_PATH)) {
      console.error("❌ Excel 파일이 없습니다:", XLSX_PATH);
      return { synced: false, reason: "xlsx_not_found", xlsxPath: XLSX_PATH };
    }

    const db = new Database(DB_PATH);
    ensureTables(db);

    const buf = fs.readFileSync(XLSX_PATH);
    const wb = XLSX.read(buf, { type: "buffer", cellDates: true });

    const ws = wb.Sheets["Client"];
    if (!ws) {
      console.error("❌ 'Client' 시트를 찾을 수 없습니다");
      return { synced: false, reason: "sheet_not_found" };
    }

    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

    // 0-based index: E=4, F=5, M=12, N=13, T=19
    const IDX_CLIENT_NAME = 4;
    const IDX_CLIENT_CODE = 5;
    const IDX_ITEM_NO = 12;
    const IDX_ITEM_NAME = 13;
    const IDX_SUPPLY_PRICE = 19;

    const clientMap = new Map();
    const itemMap = new Map();

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

    db.close();

    console.log("✅ Excel → DB 동기화 완료!");
    console.log(`   - 거래처: ${clientMap.size}개`);
    console.log(`   - 품목: ${itemMap.size}개`);

    return { synced: true, clients: clientMap.size, items: itemMap.size };
  } catch (e) {
    console.error("❌ 동기화 실패:", e.message);
    return { synced: false, reason: "sync_error", error: e.message, xlsxPath: XLSX_PATH };
  }
}

// 실행
const result = syncFromXlsx();
console.log("\n최종 결과:", JSON.stringify(result, null, 2));
