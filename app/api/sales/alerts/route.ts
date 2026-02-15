import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

const DEFAULT_STOCK_RULES = {
  price_300k: 6,
  price_200k: 12,
  price_100k: 60,
  price_50k: 120,
  price_20k: 180,
  price_under_20k: 300,
};

async function loadStockRules() {
  const { data } = await supabase
    .from('admin_settings').select('value').eq('key', 'recommend_stock_rules').maybeSingle();
  return data ? { ...DEFAULT_STOCK_RULES, ...JSON.parse(data.value) } : { ...DEFAULT_STOCK_RULES };
}

function minStockForPrice(price: number, SR: typeof DEFAULT_STOCK_RULES): number {
  if (price >= 300000) return SR.price_300k;
  if (price >= 200000) return SR.price_200k;
  if (price >= 100000) return SR.price_100k;
  if (price >= 50000) return SR.price_50k;
  if (price >= 20000) return SR.price_20k;
  return SR.price_under_20k;
}

// ── POST: 담당자 기준 재고 부족 스캔 ──
// body: { manager, dismissed_items?: string[] }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const manager = body.manager;
    const dismissedItems: string[] = body.dismissed_items || [];

    if (!manager) {
      return NextResponse.json({ error: '담당자를 선택해주세요.' }, { status: 400 });
    }

    const SR = await loadStockRules();

    // 1. 해당 담당자의 최근 12개월 출고 기록 조회
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const cutoffDate = twelveMonthsAgo.toISOString().slice(0, 10);

    // shipments에서 해당 담당자의 모든 출고 조회 (페이지네이션)
    const allShipments: any[] = [];
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

    if (allShipments.length === 0) {
      return NextResponse.json({
        alerts: [],
        total: 0,
        scanned_at: new Date().toISOString(),
      });
    }

    // 2. 품목별 거래처 집계
    //    item_no → { item_name, clients: { client_code → { name, qty, last_date } } }
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

    // 3. 재고 조회
    const itemNos = Array.from(itemMap.keys());
    const inventoryMap = new Map<string, any>();

    // 배치로 조회 (Supabase .in()은 대량 제한 있을 수 있음)
    for (let i = 0; i < itemNos.length; i += 500) {
      const batch = itemNos.slice(i, i + 500);
      const { data: invData } = await supabase
        .from('inventory_cdv')
        .select('item_no, item_name, country, supply_price, available_stock, bonded_warehouse, avg_sales_90d')
        .in('item_no', batch);
      for (const inv of invData || []) {
        inventoryMap.set(inv.item_no, inv);
      }
    }

    // 4. DB에서 dismissed 목록 로드
    const { data: dbDismissed } = await supabase
      .from('inventory_alerts')
      .select('item_no')
      .eq('status', 'dismissed');
    const dismissedSet = new Set([
      ...dismissedItems,
      ...(dbDismissed || []).map(d => d.item_no),
    ]);

    // 5. 부족 판별
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

    const alerts: AlertResult[] = [];

    for (const [itemNo, entry] of itemMap) {
      // dismissed 제외
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
      } else if (totalStock < threshold) {
        isShortage = true;
        alertType = 'low_stock';
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

      // 거래처 목록 (수량 많은 순)
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

    // 정렬: 품절 우선, 그 다음 출고량 많은 순
    alerts.sort((a, b) => {
      if (a.alert_type === 'out_of_stock' && b.alert_type !== 'out_of_stock') return -1;
      if (a.alert_type !== 'out_of_stock' && b.alert_type === 'out_of_stock') return 1;
      return b.total_shipped - a.total_shipped;
    });

    return NextResponse.json({
      alerts,
      total: alerts.length,
      out_of_stock_count: alerts.filter(a => a.alert_type === 'out_of_stock').length,
      low_stock_count: alerts.filter(a => a.alert_type === 'low_stock').length,
      scanned_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Alerts POST error:', error);
    return NextResponse.json(
      { error: '재고 스캔 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// ── PATCH: 품목 dismiss/restore ──
// body: { item_nos: string[], action: 'dismiss' | 'restore' }
export async function PATCH(req: Request) {
  try {
    const { item_nos, action } = await req.json();
    if (!item_nos || !Array.isArray(item_nos) || item_nos.length === 0) {
      return NextResponse.json({ error: 'item_nos 배열이 필요합니다.' }, { status: 400 });
    }

    if (action === 'dismiss') {
      // 기존에 있으면 status를 dismissed로 업데이트, 없으면 insert
      for (const itemNo of item_nos) {
        const { data: existing } = await supabase
          .from('inventory_alerts')
          .select('id')
          .eq('item_no', itemNo)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('inventory_alerts')
            .update({ status: 'dismissed' })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('inventory_alerts')
            .insert({
              item_no: itemNo,
              item_name: '',
              alert_type: 'out_of_stock',
              current_stock: 0,
              threshold: 0,
              affected_clients: [],
              status: 'dismissed',
            });
        }
      }
      return NextResponse.json({ success: true, dismissed: item_nos.length });
    }

    if (action === 'restore') {
      await supabase
        .from('inventory_alerts')
        .delete()
        .in('item_no', item_nos)
        .eq('status', 'dismissed');
      return NextResponse.json({ success: true, restored: item_nos.length });
    }

    return NextResponse.json({ error: '유효하지 않은 action입니다. dismiss 또는 restore' }, { status: 400 });
  } catch (error) {
    console.error('Alerts PATCH error:', error);
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
