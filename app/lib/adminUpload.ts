// app/lib/adminUpload.ts
// 관리자 엑셀 업로드 → DB 교체 로직

import * as XLSX from "xlsx";
import { db } from "@/app/lib/db";
import { logger } from "@/app/lib/logger";

/* ─── 유틸 ─── */
function normCode(x: unknown) {
  return String(x ?? "").trim().replace(/\.0$/, "");
}
function normText(x: unknown) {
  return String(x ?? "").trim();
}
function toNumber(x: unknown): number | null {
  if (x == null) return null;
  const s = String(x).replace(/,/g, "").trim();
  if (!s || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/* ─── 업로드 타입 정의 ─── */
export const UPLOAD_TYPES = {
  client: {
    label: "거래처별 와인 출고현황",
    description: "Client 시트 - 와인 거래처/품목 데이터",
  },
  "dl-client": {
    label: "거래처별 글라스 출고현황",
    description: "DL-Client 시트 - 글라스 거래처/품목 데이터",
  },
  riedel: {
    label: "리델리스트",
    description: "리델 가격 리스트",
  },
  downloads: {
    label: "와인재고현황",
    description: "와인 재고 현황 데이터",
  },
  dl: {
    label: "글라스재고현황",
    description: "글라스 재고 현황 데이터",
  },
  english: {
    label: "와인리스트",
    description: "와인 영문/한글 가격 리스트",
  },
} as const;

export type UploadType = keyof typeof UPLOAD_TYPES;

export function isValidUploadType(type: string): type is UploadType {
  return type in UPLOAD_TYPES;
}

/* ─── Client / DL-Client 공통 파서 ─── */
// Header row 0: 열1, 선택, 사업장, 출고번호, 판매처(4), 판매처번호(5), ...
// 품번(12), 품명(13), 판매단가(16), 기준단가(19)
function parseClientSheet(rows: unknown[][]) {
  const IDX_CLIENT_NAME = 4;
  const IDX_CLIENT_CODE = 5;
  const IDX_ITEM_NO = 12;
  const IDX_ITEM_NAME = 13;
  const IDX_SUPPLY_PRICE = 19;

  const clientMap = new Map<string, string>();
  const itemMap = new Map<
    string,
    { client_code: string; item_no: string; item_name: string; supply_price: number | null }
  >();

  for (let i = 1; i < rows.length; i++) {
    const r = (rows[i] || []) as unknown[];
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

  return { clientMap, itemMap };
}

/* ─── Glass(DL-Client) 파서: 공급가 = Q(16) ─── */
function parseDlClientSheet(rows: unknown[][]) {
  const IDX_CLIENT_NAME = 4;
  const IDX_CLIENT_CODE = 5;
  const IDX_ITEM_NO = 12;
  const IDX_ITEM_NAME = 13;
  const IDX_GL_PRICE = 16;

  const clientMap = new Map<string, string>();
  const itemsMap = new Map<string, string>(); // itemNo -> itemName
  const clientItemsMap = new Map<
    string,
    { clientCode: string; itemNo: string; itemName: string; price: number }
  >();

  for (let i = 1; i < rows.length; i++) {
    const r = (rows[i] || []) as unknown[];
    const clientName = normText(r[IDX_CLIENT_NAME]);
    const clientCode = normCode(r[IDX_CLIENT_CODE]);
    const itemNo = normCode(r[IDX_ITEM_NO]);
    const itemName = normText(r[IDX_ITEM_NAME]);
    const price = parseFloat(String(r[IDX_GL_PRICE])) || 0;

    if (!clientCode || !itemNo || !clientName || !itemName) continue;

    if (!clientMap.has(clientCode)) clientMap.set(clientCode, clientName);
    if (!itemsMap.has(itemNo)) itemsMap.set(itemNo, itemName);

    const key = `${clientCode}:${itemNo}`;
    if (!clientItemsMap.has(key)) {
      clientItemsMap.set(key, { clientCode, itemNo, itemName, price });
    }
  }

  return { clientMap, itemsMap, clientItemsMap };
}

/* ─── 업로드 처리기들 ─── */

function processClient(buf: Buffer) {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("시트를 찾을 수 없습니다.");

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
  const { clientMap, itemMap } = parseClientSheet(rows);

  if (clientMap.size === 0) throw new Error("거래처 데이터가 없습니다. 엑셀 형식을 확인하세요.");

  // 기존 syncFromXlsx.ts와 동일한 테이블/로직 사용
  db.prepare(`CREATE TABLE IF NOT EXISTS clients (
    client_code TEXT PRIMARY KEY, client_name TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS client_alias (
    client_code TEXT NOT NULL, alias TEXT NOT NULL, weight INTEGER DEFAULT 1, PRIMARY KEY (client_code, alias)
  )`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS client_item_stats (
    client_code TEXT NOT NULL, item_no TEXT NOT NULL, item_name TEXT NOT NULL,
    supply_price REAL, buy_count INTEGER DEFAULT 0, updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (client_code, item_no)
  )`).run();

  const upsertClient = db.prepare(`
    INSERT INTO clients (client_code, client_name, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(client_code) DO UPDATE SET client_name = excluded.client_name, updated_at = CURRENT_TIMESTAMP
  `);
  const upsertAlias = db.prepare(`
    INSERT INTO client_alias (client_code, alias, weight) VALUES (?, ?, 10)
    ON CONFLICT(client_code, alias) DO UPDATE SET weight = CASE WHEN client_alias.weight < 10 THEN 10 ELSE client_alias.weight END
  `);
  const upsertItem = db.prepare(`
    INSERT INTO client_item_stats (client_code, item_no, item_name, supply_price, buy_count) VALUES (?, ?, ?, ?, 0)
    ON CONFLICT(client_code, item_no) DO UPDATE SET item_name = excluded.item_name, supply_price = excluded.supply_price
  `);

  db.transaction(() => {
    // 엑셀 유래 데이터만 삭제 (학습 데이터 보존)
    db.prepare("DELETE FROM client_item_stats").run();
    db.prepare("DELETE FROM clients").run();
    db.prepare("DELETE FROM client_alias WHERE weight >= 10").run();

    for (const [code, name] of clientMap.entries()) {
      upsertClient.run(code, name);
      upsertAlias.run(code, name);
    }
    for (const v of itemMap.values()) {
      upsertItem.run(v.client_code, v.item_no, v.item_name, v.supply_price);
    }
  })();

  return { clients: clientMap.size, items: itemMap.size };
}

function processDlClient(buf: Buffer) {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("시트를 찾을 수 없습니다.");

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
  const { clientMap, itemsMap, clientItemsMap } = parseDlClientSheet(rows);

  if (clientMap.size === 0) throw new Error("거래처 데이터가 없습니다. 엑셀 형식을 확인하세요.");

  // 기존 glass 테이블 구조 사용
  db.prepare(`CREATE TABLE IF NOT EXISTS glass_clients (
    client_code TEXT PRIMARY KEY, client_name TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS glass_client_alias (
    client_code TEXT NOT NULL, alias TEXT NOT NULL, weight INTEGER DEFAULT 10, PRIMARY KEY (client_code, alias)
  )`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS glass_items (
    item_no TEXT PRIMARY KEY, item_name TEXT NOT NULL, supply_price REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS glass_client_item_stats (
    client_code TEXT NOT NULL, item_no TEXT NOT NULL, item_name TEXT NOT NULL,
    supply_price REAL DEFAULT 0, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (client_code, item_no)
  )`).run();

  const upsertClient = db.prepare(`
    INSERT INTO glass_clients (client_code, client_name) VALUES (?, ?)
    ON CONFLICT(client_code) DO UPDATE SET client_name = excluded.client_name
  `);
  const upsertAlias = db.prepare(`
    INSERT INTO glass_client_alias (client_code, alias, weight) VALUES (?, ?, 10)
    ON CONFLICT(client_code, alias) DO UPDATE SET weight = CASE WHEN glass_client_alias.weight < 10 THEN 10 ELSE glass_client_alias.weight END
  `);
  const upsertItem = db.prepare(`
    INSERT INTO glass_items (item_no, item_name, supply_price, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(item_no) DO UPDATE SET item_name = excluded.item_name, supply_price = excluded.supply_price, updated_at = CURRENT_TIMESTAMP
  `);
  const upsertClientItem = db.prepare(`
    INSERT INTO glass_client_item_stats (client_code, item_no, item_name, supply_price, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(client_code, item_no) DO UPDATE SET item_name = excluded.item_name, supply_price = excluded.supply_price, updated_at = CURRENT_TIMESTAMP
  `);

  db.transaction(() => {
    // FK 순서: 자식 테이블 먼저 삭제 (glass_client_item_stats → glass_client_alias → glass_items → glass_clients)
    db.prepare("DELETE FROM glass_client_item_stats").run();
    db.prepare("DELETE FROM glass_client_alias WHERE weight >= 10").run();
    db.prepare("DELETE FROM glass_items").run();
    db.prepare("DELETE FROM glass_clients").run();

    for (const [code, name] of clientMap.entries()) {
      upsertClient.run(code, name);
      upsertAlias.run(code, name);
    }
    for (const [no, name] of itemsMap.entries()) {
      upsertItem.run(no, name, 0);
    }
    for (const item of clientItemsMap.values()) {
      upsertClientItem.run(item.clientCode, item.itemNo, item.itemName, item.price);
    }
  })();

  return { clients: clientMap.size, items: itemsMap.size, clientItems: clientItemsMap.size };
}

function processRiedel(buf: Buffer) {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("시트를 찾을 수 없습니다.");

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

  // 헤더 행 찾기: "Code" 컬럼이 있는 행
  let headerIdx = -1;
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const r = (rows[i] || []) as unknown[];
    if (r.some((c) => String(c).trim() === "Code")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) throw new Error("리델 헤더 행을 찾을 수 없습니다. 'Code' 컬럼이 필요합니다.");

  // 기존 glass_items 테이블에 리델 공급가 업데이트 + 별도 riedel_items 테이블
  db.prepare(`CREATE TABLE IF NOT EXISTS riedel_items (
    code TEXT PRIMARY KEY, series TEXT, item_kr TEXT, item_en TEXT,
    unit INTEGER, supply_price REAL, box_price REAL, note TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();

  const insert = db.prepare(`
    INSERT INTO riedel_items (code, series, item_kr, item_en, unit, supply_price, box_price, note, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  // 리델 공급가를 glass_items에도 반영
  const updateGlassPrice = db.prepare(`
    UPDATE glass_items SET supply_price = ?, updated_at = CURRENT_TIMESTAMP WHERE item_no = ?
  `);

  let count = 0;
  let lastSeries = "";

  db.transaction(() => {
    db.prepare("DELETE FROM riedel_items").run();

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = (rows[i] || []) as unknown[];
      const code = normText(r[1]);
      if (!code) continue;

      const series = normText(r[0]) || lastSeries;
      if (normText(r[0])) lastSeries = normText(r[0]);

      const supplyPrice = toNumber(r[5]);

      insert.run(code, series, normText(r[2]), normText(r[3]), toNumber(r[4]), supplyPrice, toNumber(r[6]), normText(r[7]));

      // glass_items에 공급가 반영
      if (supplyPrice != null) {
        updateGlassPrice.run(supplyPrice, code);
      }

      count++;
    }
  })();

  return { items: count };
}

function processDownloads(buf: Buffer) {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("시트를 찾을 수 없습니다.");

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
  // Header row 0: 열1, 품번(1), 품명(2), 규격(3), 단위(4), IP(5), 빈티지(6), 알콜도수%(7),
  //   국가(8), 표준바코드(9), 출고예정(10), 가용재고(11), 30일출고(12), 90일/3평균출고(13),
  //   365일/12평균출고(14), 공급가(15), 할인공급가(16), 도매장가(17), 판매가(18), 최저판매가(19)

  // 기존 inventory_cdv 테이블 사용
  db.prepare(`CREATE TABLE IF NOT EXISTS inventory_cdv (
    item_no TEXT PRIMARY KEY, item_name TEXT, supply_price REAL, available_stock REAL,
    bonded_warehouse REAL, sales_30days REAL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    discount_price REAL, wholesale_price REAL, retail_price REAL, min_price REAL,
    incoming_stock REAL, vintage TEXT, alcohol_content TEXT, country TEXT
  )`).run();

  // items 마스터 테이블도 함께 업데이트
  db.prepare(`CREATE TABLE IF NOT EXISTS items (
    item_no TEXT PRIMARY KEY, item_name TEXT, supply_price REAL,
    category TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();

  const upsertInventory = db.prepare(`
    INSERT INTO inventory_cdv (item_no, item_name, supply_price, available_stock, bonded_warehouse,
      sales_30days, discount_price, wholesale_price, retail_price, min_price, incoming_stock,
      vintage, alcohol_content, country, updated_at)
    VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 0, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(item_no) DO UPDATE SET
      item_name = excluded.item_name, supply_price = excluded.supply_price,
      available_stock = excluded.available_stock, sales_30days = excluded.sales_30days,
      discount_price = excluded.discount_price, wholesale_price = excluded.wholesale_price,
      retail_price = excluded.retail_price, min_price = excluded.min_price,
      vintage = excluded.vintage, alcohol_content = excluded.alcohol_content,
      country = excluded.country, updated_at = CURRENT_TIMESTAMP
  `);

  const upsertItem = db.prepare(`
    INSERT INTO items (item_no, item_name, supply_price, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(item_no) DO UPDATE SET item_name = excluded.item_name, supply_price = excluded.supply_price, updated_at = CURRENT_TIMESTAMP
  `);

  let count = 0;

  db.transaction(() => {
    db.prepare("DELETE FROM inventory_cdv").run();
    db.prepare("DELETE FROM items").run();

    for (let i = 1; i < rows.length; i++) {
      const r = (rows[i] || []) as unknown[];
      const item_no = normCode(r[1]);
      if (!item_no) continue;

      const item_name = normText(r[2]);
      const supply_price = toNumber(r[15]);

      upsertInventory.run(
        item_no, item_name, supply_price,
        toNumber(r[11]), // available_stock
        toNumber(r[12]), // sales_30days
        toNumber(r[16]), // discount_price
        toNumber(r[17]), // wholesale_price
        toNumber(r[18]), // retail_price
        toNumber(r[19]), // min_price
        normText(r[6]),  // vintage
        normText(r[7]),  // alcohol
        normText(r[8])   // country
      );

      upsertItem.run(item_no, item_name, supply_price);
      count++;
    }
  })();

  return { items: count };
}

function processDl(buf: Buffer) {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("시트를 찾을 수 없습니다.");

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
  // 동일 구조: 열1, 품번(1), 품명(2), 규격(3), 단위(4), IP(5), 빈티지(6), 알콜도수%(7),
  //   국가(8), ... 공급가(15)

  // 기존 inventory_dl 테이블 사용
  db.prepare(`CREATE TABLE IF NOT EXISTS inventory_dl (
    item_no TEXT PRIMARY KEY, item_name TEXT, supply_price REAL, available_stock REAL,
    anseong_warehouse REAL, sales_30days REAL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    vintage TEXT, alcohol_content TEXT, country TEXT
  )`).run();

  const upsert = db.prepare(`
    INSERT INTO inventory_dl (item_no, item_name, supply_price, available_stock, anseong_warehouse,
      sales_30days, vintage, alcohol_content, country, updated_at)
    VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(item_no) DO UPDATE SET
      item_name = excluded.item_name, supply_price = excluded.supply_price,
      available_stock = excluded.available_stock, sales_30days = excluded.sales_30days,
      vintage = excluded.vintage, alcohol_content = excluded.alcohol_content,
      country = excluded.country, updated_at = CURRENT_TIMESTAMP
  `);

  let count = 0;

  db.transaction(() => {
    db.prepare("DELETE FROM inventory_dl").run();

    for (let i = 1; i < rows.length; i++) {
      const r = (rows[i] || []) as unknown[];
      const item_no = normCode(r[1]);
      if (!item_no) continue;

      upsert.run(
        item_no,
        normText(r[2]),  // item_name
        toNumber(r[15]), // supply_price
        toNumber(r[11]), // available_stock
        toNumber(r[12]), // sales_30days
        normText(r[6]),  // vintage
        normText(r[7]),  // alcohol
        normText(r[8])   // country
      );
      count++;
    }
  })();

  return { items: count };
}

function processEnglish(buf: Buffer) {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("시트를 찾을 수 없습니다.");

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

  // 헤더 행 찾기: 국가(country) 컬럼이 있는 행
  let headerIdx = -1;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const r = (rows[i] || []) as unknown[];
    if (r.some((c) => String(c).includes("country") || String(c).includes("국가"))) {
      headerIdx = i;
      break;
    }
  }
  // 데이터 시작: 헤더 + 서브헤더(영문/한글) 건너뛰기
  const dataStart = headerIdx >= 0 ? headerIdx + 2 : 4;

  // Data columns (0-based):
  // 0=seq, 1=item_no, 2=?, 3=country, 4=supplier, 5=region, 6=image,
  // 7=wine_name_en, 8=wine_name_kr, 9=vintage, 10=ml, 11=supply_price,
  // 12=supplier_name, 13=stock, 14=bonded

  db.prepare(`CREATE TABLE IF NOT EXISTS wine_list_english (
    item_no TEXT PRIMARY KEY, country TEXT, supplier TEXT, region TEXT,
    wine_name_en TEXT, wine_name_kr TEXT, vintage TEXT, ml INTEGER,
    supply_price REAL, supplier_name TEXT, stock INTEGER, bonded INTEGER,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();

  const insert = db.prepare(`
    INSERT INTO wine_list_english (item_no, country, supplier, region, wine_name_en, wine_name_kr,
      vintage, ml, supply_price, supplier_name, stock, bonded, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  let count = 0;

  db.transaction(() => {
    db.prepare("DELETE FROM wine_list_english").run();

    for (let i = dataStart; i < rows.length; i++) {
      const r = (rows[i] || []) as unknown[];
      const item_no = normCode(r[1]);
      if (!item_no) continue;

      insert.run(
        item_no,
        normText(r[3]),  // country
        normText(r[4]),  // supplier
        normText(r[5]),  // region
        normText(r[7]),  // wine_name_en
        normText(r[8]),  // wine_name_kr
        normText(r[9]),  // vintage
        toNumber(r[10]), // ml
        toNumber(r[11]), // supply_price
        normText(r[12]), // supplier_name
        toNumber(r[13]), // stock
        toNumber(r[14])  // bonded
      );
      count++;
    }
  })();

  return { items: count };
}

/* ─── 메인 처리 함수 ─── */
export function processUpload(type: UploadType, fileBuffer: Buffer) {
  logger.info(`Admin upload: processing type=${type}, size=${fileBuffer.length}`);

  switch (type) {
    case "client":
      return processClient(fileBuffer);
    case "dl-client":
      return processDlClient(fileBuffer);
    case "riedel":
      return processRiedel(fileBuffer);
    case "downloads":
      return processDownloads(fileBuffer);
    case "dl":
      return processDl(fileBuffer);
    case "english":
      return processEnglish(fileBuffer);
    default:
      throw new Error(`지원하지 않는 업로드 타입: ${type}`);
  }
}
