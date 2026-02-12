// app/lib/syncFromXlsx.ts (Supabase)
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { supabase } from "@/app/lib/db";
import { config } from "@/app/lib/config";

const XLSX_PATH = config.excel.path
  ? (path.isAbsolute(config.excel.path) ? config.excel.path : path.join(process.cwd(), config.excel.path))
  : path.join(process.cwd(), "order-ai.xlsx");

let lastMtimeMs = 0;

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

export async function syncFromXlsxIfNeeded() {
  try {
    if (!fs.existsSync(XLSX_PATH)) {
      return { synced: false, reason: "xlsx_not_found" as const, xlsxPath: XLSX_PATH };
    }

    const stat = fs.statSync(XLSX_PATH);

    // DB에 데이터가 있는지 확인
    const { count } = await supabase
      .from("client_item_stats")
      .select("*", { count: "exact", head: true });
    const hasData = (count || 0) > 0;

    if (lastMtimeMs && stat.mtimeMs === lastMtimeMs && hasData) {
      return { synced: false, reason: "not_changed" as const };
    }

    const buf = fs.readFileSync(XLSX_PATH);
    const wb = XLSX.read(buf, { type: "buffer", cellDates: true });

    const ws = wb.Sheets["Client"];
    if (!ws) return { synced: false, reason: "sheet_not_found" as const };

    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" });

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

    // Batch upsert clients
    const clientRows = Array.from(clientMap.entries()).map(([code, name]) => ({
      client_code: code,
      client_name: name,
      updated_at: new Date().toISOString(),
    }));
    if (clientRows.length > 0) {
      // chunk to avoid payload limits
      for (let i = 0; i < clientRows.length; i += 500) {
        await supabase.from("clients").upsert(clientRows.slice(i, i + 500), { onConflict: "client_code" });
      }
    }

    // Batch upsert client_alias (name as alias)
    const aliasRows = Array.from(clientMap.entries()).map(([code, name]) => ({
      client_code: code,
      alias: name,
      weight: 10,
    }));
    if (aliasRows.length > 0) {
      for (let i = 0; i < aliasRows.length; i += 500) {
        await supabase.from("client_alias").upsert(aliasRows.slice(i, i + 500), { onConflict: "client_code,alias" });
      }
    }

    // Batch upsert client_item_stats
    const itemRows = Array.from(itemMap.values()).map((v) => ({
      client_code: v.client_code,
      item_no: v.item_no,
      item_name: v.item_name,
      supply_price: v.supply_price,
      buy_count: 0,
    }));
    if (itemRows.length > 0) {
      for (let i = 0; i < itemRows.length; i += 500) {
        await supabase.from("client_item_stats").upsert(itemRows.slice(i, i + 500), { onConflict: "client_code,item_no" });
      }
    }

    lastMtimeMs = stat.mtimeMs;
    return { synced: true, clients: clientMap.size, items: itemMap.size };
  } catch (e: any) {
    const msg = String(e?.message || e);
    return { synced: false, reason: "sync_error" as const, error: msg, xlsxPath: XLSX_PATH };
  }
}

/* ==================== Glass(DL-Client) 테이블 동기화 ==================== */
let lastGlassMtimeMs = 0;

export async function syncGlassFromXlsxIfNeeded() {
  try {
    if (!fs.existsSync(XLSX_PATH)) {
      return { synced: false, reason: "xlsx_not_found" as const, xlsxPath: XLSX_PATH };
    }

    const stat = fs.statSync(XLSX_PATH);

    const { count: glassCount } = await supabase
      .from("glass_items")
      .select("*", { count: "exact", head: true });
    const hasData = (glassCount || 0) > 0;

    if (lastGlassMtimeMs && stat.mtimeMs === lastGlassMtimeMs && hasData) {
      return { synced: false, reason: "not_changed" as const };
    }

    const buf = fs.readFileSync(XLSX_PATH);
    const wb = XLSX.read(buf, { type: "buffer", cellDates: true });

    const ws = wb.Sheets["DL-Client"];
    if (!ws) return { synced: false, reason: "dl_client_sheet_not_found" as const };

    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" });

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

      if (!clientsMap.has(clientCode)) clientsMap.set(clientCode, clientName);
      if (!itemsMap.has(itemNo)) itemsMap.set(itemNo, itemName);
      const key = `${clientCode}:${itemNo}`;
      if (!clientItemsMap.has(key)) {
        clientItemsMap.set(key, { clientCode, itemNo, itemName, price });
      }
    }

    // Batch upsert glass_clients
    const gcRows = Array.from(clientsMap.entries()).map(([code, name]) => ({
      client_code: code,
      client_name: name,
    }));
    if (gcRows.length > 0) {
      for (let i = 0; i < gcRows.length; i += 500) {
        await supabase.from("glass_clients").upsert(gcRows.slice(i, i + 500), { onConflict: "client_code" });
      }
    }

    // Batch upsert glass_client_alias
    const gaRows = Array.from(clientsMap.entries()).map(([code, name]) => ({
      client_code: code,
      alias: name,
      weight: 10,
    }));
    if (gaRows.length > 0) {
      for (let i = 0; i < gaRows.length; i += 500) {
        await supabase.from("glass_client_alias").upsert(gaRows.slice(i, i + 500), { onConflict: "client_code,alias" });
      }
    }

    // Batch upsert glass_items
    const giRows = Array.from(itemsMap.entries()).map(([no, name]) => ({
      item_no: no,
      item_name: name,
      supply_price: 0,
      updated_at: new Date().toISOString(),
    }));
    if (giRows.length > 0) {
      for (let i = 0; i < giRows.length; i += 500) {
        await supabase.from("glass_items").upsert(giRows.slice(i, i + 500), { onConflict: "item_no" });
      }
    }

    // Batch upsert glass_client_item_stats
    const gciRows = Array.from(clientItemsMap.values()).map((item) => ({
      client_code: item.clientCode,
      item_no: item.itemNo,
      item_name: item.itemName,
      supply_price: item.price,
      updated_at: new Date().toISOString(),
    }));
    if (gciRows.length > 0) {
      for (let i = 0; i < gciRows.length; i += 500) {
        await supabase.from("glass_client_item_stats").upsert(gciRows.slice(i, i + 500), { onConflict: "client_code,item_no" });
      }
    }

    lastGlassMtimeMs = stat.mtimeMs;

    console.log(`[Glass Sync] 거래처: ${clientsMap.size}, 품목: ${itemsMap.size}, 거래처별품목: ${clientItemsMap.size}`);
    return { synced: true, clients: clientsMap.size, items: itemsMap.size, clientItems: clientItemsMap.size };
  } catch (e: any) {
    const msg = String(e?.message || e);
    console.error("[Glass Sync Error]", msg);
    return { synced: false, reason: "sync_error" as const, error: msg };
  }
}
