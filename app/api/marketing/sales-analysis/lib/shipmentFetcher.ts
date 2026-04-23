import { supabase } from "@/app/lib/db";

export type ShipmentRow = {
  item_no: string;
  item_name: string;
  quantity: number;
  unit_price: number | null;
  selling_price: number | null;
  supply_amount: number | null;
  ship_date: string;
};

/**
 * shipments 병렬 페이지네이션 fetch.
 * 총 건수 조회 → pages 계산 → 동시성 6으로 병렬 요청.
 */
export async function fetchShipments(startDate: string, endDate: string): Promise<ShipmentRow[]> {
  const { count: shipCount } = await supabase.from('shipments')
    .select('*', { count: 'exact', head: true })
    .gte('ship_date', startDate).lte('ship_date', endDate);

  const batch = 1000;
  const pages = Math.ceil((shipCount || 0) / batch);
  const concurrency = 6;
  const all: ShipmentRow[] = [];

  for (let i = 0; i < pages; i += concurrency) {
    const promises: Promise<ShipmentRow[]>[] = [];
    for (let j = i; j < Math.min(i + concurrency, pages); j++) {
      promises.push(
        supabase.from('shipments')
          .select('item_no, item_name, quantity, unit_price, selling_price, supply_amount, ship_date')
          .gte('ship_date', startDate).lte('ship_date', endDate)
          .range(j * batch, (j + 1) * batch - 1)
          .then((r) => (r.data || []) as ShipmentRow[])
      );
    }
    const results = await Promise.all(promises);
    for (const r of results) all.push(...r);
  }

  return all;
}
