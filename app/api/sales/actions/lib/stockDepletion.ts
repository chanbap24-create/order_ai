import { supabase } from '@/app/lib/db';
import { minStockForPrice } from './constants';
import type { ShipmentRow, StockDepletion } from './types';

/**
 * 담당자 거래처가 구매하는 품목 중 재고 0 또는 소진일 < 30 감지.
 */
export async function detectStockDepletions(allShipments: ShipmentRow[]): Promise<StockDepletion[]> {
  const itemClientMap = new Map<string, {
    item_name: string;
    clients: Map<string, { client_name: string; total_qty: number }>;
    total_shipped: number;
  }>();

  for (const s of allShipments) {
    if (!s.item_no) continue;
    if (!itemClientMap.has(s.item_no)) {
      itemClientMap.set(s.item_no, {
        item_name: s.item_name || s.item_no,
        clients: new Map(),
        total_shipped: 0,
      });
    }
    const agg = itemClientMap.get(s.item_no)!;
    agg.total_shipped += (s.quantity || 1);
    const cc = s.client_code || 'unknown';
    const existing = agg.clients.get(cc);
    if (existing) {
      existing.total_qty += (s.quantity || 1);
    } else {
      agg.clients.set(cc, { client_name: s.client_name || cc, total_qty: s.quantity || 1 });
    }
  }

  // dismissed 품목 제외
  const { data: dismissedData } = await supabase
    .from('inventory_alerts')
    .select('item_no')
    .eq('status', 'dismissed');
  const dismissedSet = new Set((dismissedData || []).map((d) => d.item_no));

  const allItemNos = Array.from(itemClientMap.keys()).filter((no) => !dismissedSet.has(no));
  const invMap = new Map<string, { available_stock: number; supply_price: number; avg_sales_90d: number }>();

  for (let i = 0; i < allItemNos.length; i += 500) {
    const batch = allItemNos.slice(i, i + 500);
    const { data: cdvData } = await supabase
      .from('inventory_cdv')
      .select('item_no, available_stock, supply_price, avg_sales_90d')
      .in('item_no', batch);
    for (const d of cdvData || []) {
      invMap.set(d.item_no, {
        available_stock: d.available_stock ?? 0,
        supply_price: d.supply_price ?? 0,
        avg_sales_90d: d.avg_sales_90d ?? 0,
      });
    }
  }

  const depletions: StockDepletion[] = [];

  for (const itemNo of allItemNos) {
    const inv = invMap.get(itemNo);
    if (!inv) continue;

    const threshold = minStockForPrice(inv.supply_price);
    const stock = inv.available_stock;
    const dailySales = inv.avg_sales_90d / 90;
    const daysRemaining = dailySales > 0 ? Math.round(stock / dailySales) : null;

    let alertType: 'out_of_stock' | 'low_stock' | null = null;
    if (stock <= 0) {
      alertType = 'out_of_stock';
    } else if (daysRemaining !== null && daysRemaining < 30) {
      alertType = 'low_stock';
    }
    if (!alertType) continue;

    const itemAgg = itemClientMap.get(itemNo)!;
    const affectedClients = Array.from(itemAgg.clients.values())
      .sort((a, b) => b.total_qty - a.total_qty)
      .slice(0, 5);

    depletions.push({
      type: 'stock_depletion',
      item_no: itemNo,
      item_name: itemAgg.item_name,
      alert_type: alertType,
      current_stock: stock,
      threshold,
      supply_price: inv.supply_price,
      days_remaining: daysRemaining,
      affected_clients: affectedClients,
      total_shipped: itemAgg.total_shipped,
    });
  }

  depletions.sort((a, b) => {
    if (a.alert_type !== b.alert_type) return a.alert_type === 'out_of_stock' ? -1 : 1;
    return b.total_shipped - a.total_shipped;
  });
  depletions.splice(30);
  return depletions;
}
