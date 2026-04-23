import { supabase } from "@/app/lib/db";
import { logger } from "@/app/lib/logger";
import type { ShipmentRow } from "./types";

export async function processShipmentsFromData(
  shipments: ShipmentRow[],
  table: 'shipments' | 'glass_shipments',
  clear: boolean,
  minDate?: string
) {
  if (clear) {
    await supabase.from(table).delete().not('id', 'is', null);
    logger.info(`[Shipments] Cleared ${table}`);
  } else if (minDate) {
    // append 모드: minDate 이후 기존 행만 삭제 (중복 방지)
    const { error } = await supabase.from(table).delete().gte('ship_date', minDate);
    if (error) {
      logger.error(`[Shipments] ${table} partial delete error`, { error });
    } else {
      logger.info(`[Shipments] Deleted ${table} rows where ship_date >= ${minDate}`);
    }
  }

  let inserted = 0;
  for (let i = 0; i < shipments.length; i += 500) {
    const batch = shipments.slice(i, i + 500).map(s => ({
      ...s,
      quantity: Math.round(s.quantity ?? 0),
      unit_price: s.unit_price != null ? Math.round(s.unit_price) : null,
      selling_price: s.selling_price != null ? Math.round(s.selling_price) : null,
      supply_amount: s.supply_amount != null ? Math.round(s.supply_amount) : null,
      tax_amount: s.tax_amount != null ? Math.round(s.tax_amount) : null,
      total_amount: s.total_amount != null ? Math.round(s.total_amount) : null,
    }));
    const { error } = await supabase.from(table).insert(batch);
    if (error) {
      logger.error(`[Shipments] ${table} insert error at batch ${i}`, { error });
      throw new Error(`${table} insert failed: ${error.message}`);
    }
    inserted += batch.length;
  }

  logger.info(`[Shipments] Inserted ${inserted} rows into ${table}`);
  return { inserted };
}
