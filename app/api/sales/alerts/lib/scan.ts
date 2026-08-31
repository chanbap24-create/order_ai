import { supabase } from '@/app/lib/db';
import { loadStockRules, minStockForPrice, type StockRules } from './stockRules';

interface ClientDetail {
  client_code: string;
  client_name: string;
  total_qty: number;
  last_date: string;
}

export interface NextVintageInfo {
  item_no: string;
  vintage: string;        // '2023' 등
  available: number;
  bonded: number;
  incoming: number;
}

interface AlertResult {
  item_no: string;
  item_name: string;
  alert_type: 'low_stock' | 'out_of_stock' | 'vintage_change';
  current_stock: number;
  threshold: number;
  country: string;
  supply_price: number;
  avg_sales_90d: number;
  days_remaining: number | null;
  clients: ClientDetail[];
  total_shipped: number;
  /** 품절인데 같은 와인의 다음 빈티지가 있으면 → vintage_change + 후속 정보 */
  next_vintage?: NextVintageInfo;
}

export interface ScanResult {
  alerts: AlertResult[];
  autoRestored: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Shipment = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InventoryRow = any;

const PAGE_SIZE = 1000;
const INV_BATCH_SIZE = 500;

/**
 * 담당자의 최근 12개월 출고 → 재고 부족 스캔.
 *
 *  최적화:
 *  - shipments count + stockRules + dbDismissed 를 Promise.all 로 동시 시작
 *  - shipments 페이지를 count 기준으로 계산해 Promise.all 로 전부 병렬 fetch
 *  - inventory 배치도 Promise.all 로 병렬
 */
export async function scanManagerAlerts(
  manager: string,
  dismissedItems: string[],
): Promise<ScanResult> {
  const cutoffDate = buildCutoffDate();

  // Phase 1: 독립 쿼리 3개 동시 시작 (count 전용 head:true 로 전송량 최소화)
  const countQuery = supabase
    .from('shipments')
    .select('id', { count: 'exact', head: true })
    .eq('manager', manager)
    .gte('ship_date', cutoffDate);

  const [SR, dbDismissedRes, countRes] = await Promise.all([
    loadStockRules(),
    supabase.from('inventory_alerts').select('item_no, current_stock').eq('status', 'dismissed'),
    countQuery,
  ]);

  const dbDismissed = dbDismissedRes.data;
  const totalCount = countRes.count ?? 0;

  if (totalCount === 0) {
    return { alerts: [], autoRestored: 0 };
  }

  // Phase 2: shipments 페이지 수 계산 후 모두 병렬 fetch
  const allShipments = await fetchAllShipments(manager, cutoffDate, totalCount);

  // 품목별 거래처 집계
  const itemMap = aggregateByItem(allShipments);

  // Phase 3: inventory 일괄 조회 (shipments ∪ dismissed)
  const shipmentItemNos = Array.from(itemMap.keys());
  const dismissedItemNos = (dbDismissed || []).map((d) => d.item_no);
  const allItemNos = Array.from(new Set([...shipmentItemNos, ...dismissedItemNos]));
  const inventoryMap = await fetchInventoryParallel(allItemNos);

  // Phase 4: 재입고 자동 복원
  const autoRestoreItems = await autoRestoreDismissed(dbDismissed, inventoryMap);

  const dismissedSet = new Set([
    ...dismissedItems,
    ...(dbDismissed || [])
      .filter((d) => !autoRestoreItems.includes(d.item_no))
      .map((d) => d.item_no),
  ]);

  // Phase 5: 부족 판별 + 정렬
  const alerts = buildAlerts(itemMap, inventoryMap, dismissedSet, SR);

  // Phase 6: 품절 품목 중 같은 와인의 다음 빈티지가 있으면 '빈티지 변경'으로 재분류
  await markVintageChanges(alerts);

  const rank = (t: AlertResult['alert_type']) => (t === 'out_of_stock' ? 0 : t === 'vintage_change' ? 1 : 2);
  alerts.sort((a, b) => rank(a.alert_type) - rank(b.alert_type) || b.total_shipped - a.total_shipped);

  return { alerts, autoRestored: autoRestoreItems.length };
}

/**
 * 품절 알림 중 같은 와인(베이스 품번 = 품번[1:2]+[5:7], 3~4자리가 빈티지)의
 * 더 높은 빈티지가 재고(가용+보세+입고예정)로 존재하면 '빈티지 변경'으로 재분류.
 * 구빈티지 소진은 품절이 아니라 자연스러운 전환이므로 알림 톤을 낮추고 후속 정보를 첨부.
 */
async function markVintageChanges(alerts: AlertResult[]): Promise<void> {
  const targets = alerts.filter((a) => a.alert_type === 'out_of_stock' && /^[0-9]{7}$/.test(a.item_no));
  if (targets.length === 0) return;

  // 재고 있는 품목 전량 로드는 소규모(수백 행) — 베이스 매칭을 메모리에서 수행
  const { data: inStock } = await supabase
    .from('inventory_cdv')
    .select('item_no, available_stock, bonded_warehouse, bonded_kctc, incoming_stock')
    .or('available_stock.gt.0,bonded_warehouse.gt.0,bonded_kctc.gt.0,incoming_stock.gt.0');

  const baseOf = (c: string) => c.slice(0, 2) + c.slice(4);
  const byBase = new Map<string, Array<{ item_no: string; vintage: number; available: number; bonded: number; incoming: number }>>();
  for (const r of inStock || []) {
    const code = String(r.item_no || '');
    if (!/^[0-9]{7}$/.test(code)) continue;
    const b = baseOf(code);
    if (!byBase.has(b)) byBase.set(b, []);
    byBase.get(b)!.push({
      item_no: code,
      vintage: Number(code.slice(2, 4)),
      available: Number(r.available_stock) || 0,
      bonded: (Number(r.bonded_warehouse) || 0) + (Number(r.bonded_kctc) || 0),
      incoming: Number(r.incoming_stock) || 0,
    });
  }

  for (const a of targets) {
    const myVintage = Number(a.item_no.slice(2, 4));
    const siblings = (byBase.get(baseOf(a.item_no)) || [])
      .filter((s) => s.item_no !== a.item_no && s.vintage > myVintage
        && (s.available + s.bonded + s.incoming) > 0);
    if (siblings.length === 0) continue;
    // 가장 가까운 다음 빈티지 우선
    siblings.sort((x, y) => x.vintage - y.vintage);
    const next = siblings[0];
    a.alert_type = 'vintage_change';
    a.next_vintage = {
      item_no: next.item_no,
      vintage: `20${String(next.vintage).padStart(2, '0')}`,
      available: next.available,
      bonded: next.bonded,
      incoming: next.incoming,
    };
  }
}

function buildCutoffDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 12);
  return d.toISOString().slice(0, 10);
}

async function fetchAllShipments(
  manager: string,
  cutoffDate: string,
  totalCount: number,
): Promise<Shipment[]> {
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  if (totalPages === 0) return [];

  const pageIndices = Array.from({ length: totalPages }, (_, i) => i);

  const results = await Promise.all(
    pageIndices.map((i) =>
      supabase
        .from('shipments')
        .select('item_no, item_name, client_code, client_name, quantity, ship_date')
        .eq('manager', manager)
        .gte('ship_date', cutoffDate)
        .order('id', { ascending: true })
        .range(i * PAGE_SIZE, (i + 1) * PAGE_SIZE - 1),
    ),
  );

  const out: Shipment[] = [];
  for (const r of results) {
    if (r.error) throw r.error;
    if (r.data) out.push(...r.data);
  }
  return out;
}

function aggregateByItem(shipments: Shipment[]) {
  const itemMap = new Map<string, {
    item_name: string;
    clients: Map<string, { client_name: string; total_qty: number; last_date: string }>;
  }>();

  for (const s of shipments) {
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
  return itemMap;
}

async function fetchInventoryParallel(itemNos: string[]): Promise<Map<string, InventoryRow>> {
  const inventoryMap = new Map<string, InventoryRow>();
  if (itemNos.length === 0) return inventoryMap;

  const batches: string[][] = [];
  for (let i = 0; i < itemNos.length; i += INV_BATCH_SIZE) {
    batches.push(itemNos.slice(i, i + INV_BATCH_SIZE));
  }

  const results = await Promise.all(
    batches.map((batch) =>
      supabase
        .from('inventory_cdv')
        .select('item_no, item_name, country, supply_price, available_stock, bonded_warehouse, bonded_kctc, avg_sales_90d')
        .in('item_no', batch),
    ),
  );

  for (const r of results) {
    for (const inv of r.data || []) {
      inventoryMap.set(inv.item_no, inv);
    }
  }
  return inventoryMap;
}

async function autoRestoreDismissed(
  dbDismissed: { item_no: string; current_stock: number | null }[] | null,
  inventoryMap: Map<string, InventoryRow>,
): Promise<string[]> {
  const autoRestoreItems: string[] = [];
  if (!dbDismissed || dbDismissed.length === 0) return autoRestoreItems;

  for (const d of dbDismissed) {
    const inv = inventoryMap.get(d.item_no);
    const currentStock = inv ? (inv.available_stock || 0) + (inv.bonded_warehouse || 0) + (inv.bonded_kctc || 0) : 0;
    const dismissedStock = d.current_stock ?? 0;
    if (currentStock > dismissedStock) autoRestoreItems.push(d.item_no);
  }

  if (autoRestoreItems.length > 0) {
    await supabase
      .from('inventory_alerts')
      .delete()
      .in('item_no', autoRestoreItems)
      .eq('status', 'dismissed');
  }
  return autoRestoreItems;
}

function buildAlerts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  itemMap: Map<string, any>,
  inventoryMap: Map<string, InventoryRow>,
  dismissedSet: Set<string>,
  SR: StockRules,
): AlertResult[] {
  const alerts: AlertResult[] = [];

  for (const [itemNo, entry] of itemMap) {
    if (dismissedSet.has(itemNo)) continue;

    const inv = inventoryMap.get(itemNo);
    // 보세 2원화: bonded_warehouse + bonded_kctc 합산 (KCTC 누락 시 통관 대기 품목이 품절로 오탐)
    const totalStock = inv ? (inv.available_stock || 0) + (inv.bonded_warehouse || 0) + (inv.bonded_kctc || 0) : 0;
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

    const clientList: ClientDetail[] = Array.from(entry.clients.entries() as [string, {
      client_name: string; total_qty: number; last_date: string;
    }][])
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

  return alerts;
}
