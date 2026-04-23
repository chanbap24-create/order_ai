import { supabase } from "@/app/lib/db";
import type { Shipment } from "./types";

export async function fetchShipments(startD: string, endD: string): Promise<Shipment[]> {
  const { count: shipCount } = await supabase.from('shipments')
    .select('*', { count: 'exact', head: true })
    .gte('ship_date', startD).lte('ship_date', endD);
  const batch = 1000;
  const pages = Math.ceil((shipCount || 0) / batch);
  const concurrency = 6;
  const all: Shipment[] = [];
  for (let i = 0; i < pages; i += concurrency) {
    const promises: Promise<Shipment[]>[] = [];
    for (let j = i; j < Math.min(i + concurrency, pages); j++) {
      promises.push(
        supabase.from('shipments')
          .select('ship_date, quantity, item_no, item_name, client_name, manager, unit_price, selling_price, supply_amount, business_type')
          .gte('ship_date', startD).lte('ship_date', endD)
          .range(j * batch, (j + 1) * batch - 1)
          .then(r => (r.data || []) as Shipment[])
      );
    }
    const results = await Promise.all(promises);
    for (const r of results) all.push(...r);
  }
  return all;
}

export async function fetchPastShipments(
  itemCodes: string[],
  endExclusive: string,
): Promise<Shipment[]> {
  if (itemCodes.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < itemCodes.length; i += 100) {
    chunks.push(itemCodes.slice(i, i + 100));
  }
  const results = await Promise.all(chunks.map(async (chunk) => {
    const rows: Shipment[] = [];
    let from = 0;
    while (true) {
      const { data: page } = await supabase.from('shipments')
        .select('ship_date, quantity, item_no, item_name, client_name, manager, unit_price, selling_price, supply_amount, business_type')
        .in('item_no', chunk)
        .gte('ship_date', '2020-01-01').lt('ship_date', endExclusive)
        .range(from, from + 999);
      if (!page || page.length === 0) break;
      rows.push(...(page as Shipment[]));
      if (page.length < 1000) break;
      from += 1000;
    }
    return rows;
  }));
  const out: Shipment[] = [];
  for (const rows of results) out.push(...rows);
  return out;
}
