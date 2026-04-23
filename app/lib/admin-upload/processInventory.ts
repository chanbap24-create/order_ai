import * as XLSX from "xlsx";
import { supabase } from "@/app/lib/db";
import { logger } from "@/app/lib/logger";
import { ensureWineTables } from "@/app/lib/wineDb";
import { getCountryPair } from "@/app/lib/countryMapping";
import { recordInventoryValuePartial } from "@/app/lib/inventoryValueDb";
import { parseInventorySheet } from "./parseInventory";

type OldItem = {
  item_no: string;
  item_name: string;
  supply_price: number | null;
  available_stock: number | null;
  vintage: string | null;
  alcohol_content: string | null;
  country: string | null;
};

async function seedWinesBaselineIfEmpty() {
  try {
    ensureWineTables();
    const { count: wineCount } = await supabase.from('wines').select('*', { count: 'exact', head: true });
    if ((wineCount ?? 0) !== 0) return;

    const { data: oldItems, error: oldError } = await supabase
      .from('inventory_cdv')
      .select('item_no, item_name, supply_price, available_stock, vintage, alcohol_content, country')
      .not('item_no', 'is', null)
      .neq('item_no', '');
    if (oldError || !oldItems || oldItems.length === 0) return;

    const baselineRows = (oldItems as OldItem[]).map((item) => {
      const { kr, en } = getCountryPair(item.country || '');
      return {
        item_code: item.item_no,
        item_name_kr: item.item_name,
        country: kr || item.country,
        country_en: en,
        vintage: item.vintage,
        alcohol: item.alcohol_content,
        supply_price: item.supply_price,
        available_stock: item.available_stock,
        status: 'active',
      };
    });
    for (let i = 0; i < baselineRows.length; i += 500) {
      await supabase.from('wines').upsert(baselineRows.slice(i, i + 500), {
        onConflict: 'item_code', ignoreDuplicates: true,
      });
    }
    logger.info(`[Downloads] Baseline: ${oldItems.length} wines from old inventory_cdv as 'active'`);
  } catch (e) {
    logger.warn("[Downloads] Baseline setup failed (non-fatal)", { error: e });
  }
}

async function recordCdvInventoryValue(rows: Record<string, unknown>[]) {
  let cdvTotal = 0;
  for (const row of rows) {
    const supply = Number(row.supply_price) || 0;
    const bonded = Number(row.bonded_warehouse) || 0;
    const yongma = Number(row.yongma_logistics) || 0;
    cdvTotal += (bonded + yongma) * supply;
  }
  try {
    await recordInventoryValuePartial('cdv', cdvTotal);
    logger.info(`[Downloads] Recorded CDV inventory value: ${cdvTotal}`);
  } catch (e) {
    logger.warn("[Downloads] Failed to record inventory value (non-fatal)", { error: e });
  }
}

async function recordDlInventoryValue(rows: Record<string, unknown>[]) {
  let dlTotal = 0;
  for (const row of rows) {
    const supply = Number(row.supply_price) || 0;
    const anseong = Number(row.anseong_warehouse) || 0;
    const gig = Number(row.gig_warehouse) || 0;
    const gigMkt = Number(row.gig_marketing) || 0;
    const gigSales = Number(row.gig_sales1) || 0;
    dlTotal += (anseong + gig + gigMkt + gigSales) * supply;
  }
  try {
    await recordInventoryValuePartial('dl', dlTotal);
    logger.info(`[DL] Recorded DL inventory value: ${dlTotal}`);
  } catch (e) {
    logger.warn("[DL] Failed to record inventory value (non-fatal)", { error: e });
  }
}

export async function processDownloads(buf: Buffer) {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("시트를 찾을 수 없습니다.");

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

  await seedWinesBaselineIfEmpty();

  await supabase.from('inventory_cdv').delete().not('item_no', 'is', null);

  const inventoryRows = parseInventorySheet(rows);

  for (let i = 0; i < inventoryRows.length; i += 500) {
    const { error } = await supabase.from('inventory_cdv').upsert(inventoryRows.slice(i, i + 500), { onConflict: 'item_no' });
    if (error) {
      logger.error(`[Downloads] inventory_cdv upsert error at batch ${i}`, { error });
      throw new Error(`inventory_cdv upsert failed: ${error.message}`);
    }
  }

  await recordCdvInventoryValue(inventoryRows);
  return { items: inventoryRows.length };
}

/**
 * 브라우저에서 파싱된 재고 데이터를 받아 inventory_cdv에 저장
 * FormData 크기 제한 문제를 우회하기 위해 JSON으로 전달받음
 */
export async function processDownloadsFromData(inventoryRows: Record<string, unknown>[]) {
  if (!inventoryRows || inventoryRows.length === 0) throw new Error("재고 데이터가 없습니다.");

  await seedWinesBaselineIfEmpty();

  await supabase.from('inventory_cdv').delete().not('item_no', 'is', null);

  for (let i = 0; i < inventoryRows.length; i += 500) {
    const { error } = await supabase.from('inventory_cdv').upsert(inventoryRows.slice(i, i + 500), { onConflict: 'item_no' });
    if (error) throw new Error(`inventory_cdv upsert failed: ${error.message}`);
  }

  await recordCdvInventoryValue(inventoryRows);
  return { items: inventoryRows.length };
}

export async function processDl(buf: Buffer) {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("시트를 찾을 수 없습니다.");

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

  await supabase.from('inventory_dl').delete().not('item_no', 'is', null);

  const dlRows = parseInventorySheet(rows);

  for (let i = 0; i < dlRows.length; i += 500) {
    await supabase.from('inventory_dl').upsert(dlRows.slice(i, i + 500), { onConflict: 'item_no' });
  }

  await recordDlInventoryValue(dlRows);
  return { items: dlRows.length };
}

export async function processDlFromData(inventoryRows: Record<string, unknown>[]) {
  if (!inventoryRows || inventoryRows.length === 0) throw new Error("재고 데이터가 없습니다.");

  await supabase.from('inventory_dl').delete().not('item_no', 'is', null);

  for (let i = 0; i < inventoryRows.length; i += 500) {
    const { error } = await supabase.from('inventory_dl').upsert(inventoryRows.slice(i, i + 500), { onConflict: 'item_no' });
    if (error) throw new Error(`inventory_dl upsert failed: ${error.message}`);
  }

  await recordDlInventoryValue(inventoryRows);
  return { items: inventoryRows.length };
}
