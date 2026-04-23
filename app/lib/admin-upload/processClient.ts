import * as XLSX from "xlsx";
import { supabase } from "@/app/lib/db";
import { normCode, normText, toNumber } from "./utils";

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

export async function processClient(buf: Buffer) {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("시트를 찾을 수 없습니다.");

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
  const { clientMap, itemMap } = parseClientSheet(rows);

  if (clientMap.size === 0) throw new Error("거래처 데이터가 없습니다. 엑셀 형식을 확인하세요.");

  // 엑셀 유래 데이터만 삭제 (학습 데이터 보존)
  await supabase.from('client_item_stats').delete().not('client_code', 'is', null);
  await supabase.from('clients').delete().not('client_code', 'is', null);
  await supabase.from('client_alias').delete().gte('weight', 10);

  const clientRows = Array.from(clientMap.entries()).map(([code, name]) => ({
    client_code: code, client_name: name, updated_at: new Date().toISOString(),
  }));
  for (let i = 0; i < clientRows.length; i += 500) {
    await supabase.from('clients').upsert(clientRows.slice(i, i + 500), { onConflict: 'client_code' });
  }

  const aliasRows = Array.from(clientMap.entries()).map(([code, name]) => ({
    client_code: code, alias: name, weight: 10,
  }));
  for (let i = 0; i < aliasRows.length; i += 500) {
    await supabase.from('client_alias').upsert(aliasRows.slice(i, i + 500), { onConflict: 'client_code,alias' });
  }

  const itemRows = Array.from(itemMap.values()).map(v => ({
    client_code: v.client_code, item_no: v.item_no, item_name: v.item_name,
    supply_price: v.supply_price, buy_count: 0,
  }));
  for (let i = 0; i < itemRows.length; i += 500) {
    await supabase.from('client_item_stats').upsert(itemRows.slice(i, i + 500), { onConflict: 'client_code,item_no' });
  }

  return { clients: clientMap.size, items: itemMap.size };
}

export async function processClientFromData(
  clients: Record<string, string>,
  items: Array<{ client_code: string; item_no: string; item_name: string; supply_price: number | null }>,
  append?: boolean
) {
  if (Object.keys(clients).length === 0) throw new Error("거래처 데이터가 없습니다.");

  if (!append) {
    await supabase.from('client_item_stats').delete().not('client_code', 'is', null);
    await supabase.from('clients').delete().not('client_code', 'is', null);
    await supabase.from('client_alias').delete().gte('weight', 10);
  }

  const clientRows = Object.entries(clients).map(([code, name]) => ({
    client_code: code, client_name: name, updated_at: new Date().toISOString(),
  }));
  for (let i = 0; i < clientRows.length; i += 500) {
    await supabase.from('clients').upsert(clientRows.slice(i, i + 500), { onConflict: 'client_code' });
  }

  const aliasRows = Object.entries(clients).map(([code, name]) => ({
    client_code: code, alias: name, weight: 10,
  }));
  for (let i = 0; i < aliasRows.length; i += 500) {
    await supabase.from('client_alias').upsert(aliasRows.slice(i, i + 500), { onConflict: 'client_code,alias' });
  }

  const itemRows = items.map(v => ({
    client_code: v.client_code, item_no: v.item_no, item_name: v.item_name,
    supply_price: v.supply_price, buy_count: 0,
  }));
  for (let i = 0; i < itemRows.length; i += 500) {
    await supabase.from('client_item_stats').upsert(itemRows.slice(i, i + 500), { onConflict: 'client_code,item_no' });
  }

  return { clients: Object.keys(clients).length, items: items.length };
}
