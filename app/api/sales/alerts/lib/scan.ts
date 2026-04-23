import { supabase } from '@/app/lib/db';
import { loadStockRules, minStockForPrice } from './stockRules';

interface ClientDetail {
  client_code: string;
  client_name: string;
  total_qty: number;
  last_date: string;
}

interface AlertResult {
  item_no: string;
  item_name: string;
  alert_type: 'low_stock' | 'out_of_stock';
  current_stock: number;
  threshold: number;
  country: string;
  supply_price: number;
  avg_sales_90d: number;
  days_remaining: number | null;
  clients: ClientDetail[];
  total_shipped: number;
}

export interface ScanResult {
  alerts: AlertResult[];
  autoRestored: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Shipment = any;

/**
 * 담당자의 최근 12개월 출고 → 재고 부족 스캔.
 *  - stockRules + dbDismissed + shipments 병렬 로드
 *  - inventory 한 번에 일괄 조회 (shipments ∪ dismissed item_nos)
 *  - 재입고 자동 복원 (현재 재고 > dismissed 당시 재고)
 *  - 소진일 < 30일 or 재고 0 → 알림
 */
export async function scanManagerAlerts(
  manager: string,
  dismissedItems: string[],
): Promise<ScanResult> {
  const srPromise = loadStockRules();
  const dismissedPromise = supabase
    .from('inventory_alerts')
    .select('item_no, current_stock')
    .eq('status', 'dismissed');

  // shipments 페이지네이션
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const cutoffDate = twelveMonthsAgo.toISOString().slice(0, 10);

  const allShipments: Shipment[] = [];
  let from = 0;
  const batchSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('shipments')
      .select('item_no, item_name, client_code, client_name, quantity, ship_date')
      .eq('manager', manager)
      .gte('ship_date', cutoffDate)
      .range(from, from + batchSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allShipments.push(...data);
    if (data.length < batchSize) break;
    from += batchSize;
  }

  const [SR, dbDismissedRes] = await Promise.all([srPromise, dismissedPromise]);
  const dbDismissed = dbDismissedRes.data;

  if (allShipments.length === 0) {
    return { alerts: [], autoRestored: 0 };
  }

  // 품목별 거래처 집계
  const itemMap = new Map<string, {
    item_name: string;
    clients: Map<string, { client_name: string; total_qty: number; last_date: string }>;
  }>();

  for (const s of allShipments) {
    if (!s.item_no) continue;
    if (!itemMap.has(s.item_no)) {
      itemMap.set(s.item_no, { item_name: s.item_name || '', clients: new Map() });
    }
    const entry = itemMap.get(s.item_no)!;
    if (!entry.item_name && s.item_name) entry.item_name = s.item_name;

    const clientKey = s.client_code || s.client_name || 'unknown';
    if (!entry.clients.has(clientKey)) {
      entry.clients.set(clientKey, { client_name: s.client_name || clientKey, total_qty: 0, last_date: '' });
    }
    const cl = entry.clients.get(clientKey)!;
    cl.total_qty += (s.quantity || 1);
    if (s.ship_date && s.ship_date > cl.last_date) cl.last_date = s.ship_date;
  }

  // inventory 일괄 조회 (shipments ∪ dismissed)
  const shipmentItemNos = Array.from(itemMap.keys());
  const dismissedItemNos = (dbDismissed || []).map((d) => d.item_no);
  const allItemNos = Array.from(new Set([...shipmentItemNos, ...dismissedItemNos]));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inventoryMap = new Map<string, any>();
  for (let i = 0; i < allItemNos.length; i += 500) {
    const batch = allItemNos.slice(i, i + 500);
    const { data: invData } = await supabase
      .from('inventory_cdv')
      .select('item_no, item_name, country, supply_price, available_stock, bonded_warehouse, avg_sales_90d')
      .in('item_no', batch);
    for (const inv of invData || []) {
      inventoryMap.set(inv.item_no, inv);
    }
  }

  // 재입고 자동 복원
  const autoRestoreItems: string[] = [];
  if (dbDismissed && dbDismissed.length > 0) {
    for (const d of dbDismissed) {
      const inv = inventoryMap.get(d.item_no);
      const currentStock = inv
        ? (inv.available_stock || 0) + (inv.bonded_warehouse || 0)
        : 0;
      const dismissedStock = d.current_stock ?? 0;
      if (currentStock > dismissedStock) {
        autoRestoreItems.push(d.item_no);
      }
    }

    if (autoRestoreItems.length > 0) {
      await supabase
        .from('inventory_alerts')
        .delete()
        .in('item_no', autoRestoreItems)
        .eq('status', 'dismissed');
    }
  }

  const dismissedSet = new Set([
    ...dismissedItems,
    ...(dbDismissed || [])
      .filter((d) => !autoRestoreItems.includes(d.item_no))
      .map((d) => d.item_no),
  ]);

  // 부족 판별
  const alerts: AlertResult[] = [];

  for (const [itemNo, entry] of itemMap) {
    if (dismissedSet.has(itemNo)) continue;

    const inv = inventoryMap.get(itemNo);
    const totalStock = inv ? (inv.available_stock || 0) + (inv.bonded_warehouse || 0) : 0;
    const price = inv?.supply_price || 0;
    const threshold = minStockForPrice(price, SR);
    const avgSales90d = inv?.avg_sales_90d || 0;

    let isShortage = false;
    let alertType: 'low_stock' | 'out_of_stock' = 'low_stock';

    if (!inv || totalStock <= 0) {
      isShortage = true;
      alertType = 'out_of_stock';
    } else if (avgSales90d > 0) {
      const dailySales = avgSales90d / 90;
      if (dailySales > 0 && totalStock / dailySales < 30) {
        isShortage = true;
        alertType = 'low_stock';
      }
    }

    if (!isShortage) continue;

    const dailySales = avgSales90d > 0 ? avgSales90d / 90 : 0;
    const daysRemaining = (dailySales > 0 && totalStock > 0)
      ? Math.round(totalStock / dailySales)
      : null;

    const clientList: ClientDetail[] = Array.from(entry.clients.entries())
      .map(([code, cl]) => ({
        client_code: code,
        client_name: cl.client_name,
        total_qty: cl.total_qty,
        last_date: cl.last_date,
      }))
      .sort((a, b) => b.total_qty - a.total_qty);

    const totalShipped = clientList.reduce((sum, c) => sum + c.total_qty, 0);

    alerts.push({
      item_no: itemNo,
      item_name: inv?.item_name || entry.item_name,
      alert_type: alertType,
      current_stock: totalStock,
      threshold,
      country: inv?.country || '',
      supply_price: price,
      avg_sales_90d: avgSales90d,
      days_remaining: daysRemaining,
      clients: clientList,
      total_shipped: totalShipped,
    });
  }

  // 정렬: 품절 우선 → 출고량 순
  alerts.sort((a, b) => {
    if (a.alert_type === 'out_of_stock' && b.alert_type !== 'out_of_stock') return -1;
    if (a.alert_type !== 'out_of_stock' && b.alert_type === 'out_of_stock') return 1;
    return b.total_shipped - a.total_shipped;
  });

  return { alerts, autoRestored: autoRestoreItems.length };
}
