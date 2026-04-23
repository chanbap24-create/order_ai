import * as XLSX from "xlsx";
import { supabase } from "@/app/lib/db";
import { normCode, normText } from "./utils";

/* Glass(DL-Client) 파서: 공급가 = Q(16) */
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

export async function processDlClient(buf: Buffer) {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("시트를 찾을 수 없습니다.");

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
  const { clientMap, itemsMap, clientItemsMap } = parseDlClientSheet(rows);

  if (clientMap.size === 0) throw new Error("거래처 데이터가 없습니다. 엑셀 형식을 확인하세요.");

  // FK 순서: 자식 테이블 먼저 삭제
  await supabase.from('glass_client_item_stats').delete().not('client_code', 'is', null);
  await supabase.from('glass_client_alias').delete().gte('weight', 10);
  await supabase.from('glass_items').delete().not('item_no', 'is', null);
  await supabase.from('glass_clients').delete().not('client_code', 'is', null);

  const clientRows = Array.from(clientMap.entries()).map(([code, name]) => ({
    client_code: code, client_name: name,
  }));
  for (let i = 0; i < clientRows.length; i += 500) {
    await supabase.from('glass_clients').upsert(clientRows.slice(i, i + 500), { onConflict: 'client_code' });
  }

  const aliasRows = Array.from(clientMap.entries()).map(([code, name]) => ({
    client_code: code, alias: name, weight: 10,
  }));
  for (let i = 0; i < aliasRows.length; i += 500) {
    await supabase.from('glass_client_alias').upsert(aliasRows.slice(i, i + 500), { onConflict: 'client_code,alias' });
  }

  const itemRows = Array.from(itemsMap.entries()).map(([no, name]) => ({
    item_no: no, item_name: name, supply_price: 0, updated_at: new Date().toISOString(),
  }));
  for (let i = 0; i < itemRows.length; i += 500) {
    await supabase.from('glass_items').upsert(itemRows.slice(i, i + 500), { onConflict: 'item_no' });
  }

  const clientItemRows = Array.from(clientItemsMap.values()).map(item => ({
    client_code: item.clientCode, item_no: item.itemNo, item_name: item.itemName,
    supply_price: item.price, updated_at: new Date().toISOString(),
  }));
  for (let i = 0; i < clientItemRows.length; i += 500) {
    await supabase.from('glass_client_item_stats').upsert(clientItemRows.slice(i, i + 500), { onConflict: 'client_code,item_no' });
  }

  return { clients: clientMap.size, items: itemsMap.size, clientItems: clientItemsMap.size };
}

export async function processDlClientFromData(
  clients: Record<string, string>,
  items: Array<{ client_code: string; item_no: string; item_name: string; supply_price: number }>,
  append?: boolean
) {
  if (Object.keys(clients).length === 0) throw new Error("거래처 데이터가 없습니다.");

  if (!append) {
    await supabase.from('glass_client_item_stats').delete().not('client_code', 'is', null);
    await supabase.from('glass_client_alias').delete().gte('weight', 10);
    await supabase.from('glass_items').delete().not('item_no', 'is', null);
    await supabase.from('glass_clients').delete().not('client_code', 'is', null);
  }

  const clientRows = Object.entries(clients).map(([code, name]) => ({
    client_code: code, client_name: name,
  }));
  for (let i = 0; i < clientRows.length; i += 500) {
    await supabase.from('glass_clients').upsert(clientRows.slice(i, i + 500), { onConflict: 'client_code' });
  }

  const aliasRows = Object.entries(clients).map(([code, name]) => ({
    client_code: code, alias: name, weight: 10,
  }));
  for (let i = 0; i < aliasRows.length; i += 500) {
    await supabase.from('glass_client_alias').upsert(aliasRows.slice(i, i + 500), { onConflict: 'client_code,alias' });
  }

  const itemsMap = new Map<string, string>();
  for (const item of items) {
    if (!itemsMap.has(item.item_no)) itemsMap.set(item.item_no, item.item_name);
  }
  const glassItemRows = Array.from(itemsMap.entries()).map(([no, name]) => ({
    item_no: no, item_name: name, supply_price: 0, updated_at: new Date().toISOString(),
  }));
  for (let i = 0; i < glassItemRows.length; i += 500) {
    await supabase.from('glass_items').upsert(glassItemRows.slice(i, i + 500), { onConflict: 'item_no' });
  }

  const clientItemRows = items.map(item => ({
    client_code: item.client_code, item_no: item.item_no, item_name: item.item_name,
    supply_price: item.supply_price, updated_at: new Date().toISOString(),
  }));
  for (let i = 0; i < clientItemRows.length; i += 500) {
    await supabase.from('glass_client_item_stats').upsert(clientItemRows.slice(i, i + 500), { onConflict: 'client_code,item_no' });
  }

  return { clients: Object.keys(clients).length, items: itemsMap.size, clientItems: items.length };
}
