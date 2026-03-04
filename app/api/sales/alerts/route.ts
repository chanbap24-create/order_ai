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

    // 4. DB에서 dismissed 목록 로드 + 재입고 자동 복원
    const { data: dbDismissed } = await supabase
      .from('inventory_alerts')
      .select('item_no, current_stock')
      .eq('status', 'dismissed');

    // 재입고 감지: 삭제 시점 재고보다 현재 재고가 늘었으면 자동 복원
    const autoRestoreItems: string[] = [];
    if (dbDismissed && dbDismissed.length > 0) {
      const dismissedNos = dbDismissed.map(d => d.item_no);
      // 삭제된 품목의 현재 재고 조회
      const dismissedInvMap = new Map<string, number>();
      for (let i = 0; i < dismissedNos.length; i += 500) {
        const batch = dismissedNos.slice(i, i + 500);
        const { data: invData } = await supabase
          .from('inventory_cdv')
          .select('item_no, available_stock, bonded_warehouse')
          .in('item_no', batch);
        for (const inv of invData || []) {
          dismissedInvMap.set(inv.item_no, (inv.available_stock || 0) + (inv.bonded_warehouse || 0));
        }
      }

      for (const d of dbDismissed) {
        const currentStock = dismissedInvMap.get(d.item_no) ?? 0;
        const dismissedStock = d.current_stock ?? 0;
        if (currentStock > dismissedStock) {
          autoRestoreItems.push(d.item_no);
        }
      }

      // 자동 복원 실행
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
        .filter(d => !autoRestoreItems.includes(d.item_no))
        .map(d => d.item_no),
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
      } else if (avgSales90d > 0) {
        const dailySales = avgSales90d / 90;
        if (dailySales > 0 && totalStock / dailySales < 30) {
          // 소진일 30일 미만만 알림 (threshold 규칙은 표시용으로만 유지)
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
      auto_restored: autoRestoreItems.length,
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
// body: { item_nos: string[], action: 'dismiss' | 'restore', items?: {item_no, item_name}[] }
export async function PATCH(req: Request) {
  try {
    const { item_nos, action, items } = await req.json();
    if (!item_nos || !Array.isArray(item_nos) || item_nos.length === 0) {
      return NextResponse.json({ error: 'item_nos 배열이 필요합니다.' }, { status: 400 });
    }

    if (action === 'dismiss') {
      const nameMap = new Map<string, string>();
      if (items && Array.isArray(items)) {
        for (const it of items) nameMap.set(it.item_no, it.item_name || '');
      }

      // 삭제 시점의 실제 재고량 조회 (재입고 감지용)
      const stockAtDismiss = new Map<string, number>();
      for (let i = 0; i < item_nos.length; i += 500) {
        const batch = item_nos.slice(i, i + 500);
        const { data: invData } = await supabase
          .from('inventory_cdv')
          .select('item_no, available_stock, bonded_warehouse')
          .in('item_no', batch);
        for (const inv of invData || []) {
          stockAtDismiss.set(inv.item_no, (inv.available_stock || 0) + (inv.bonded_warehouse || 0));
        }
      }

      const now = new Date().toISOString();
      const errors: string[] = [];
      for (const itemNo of item_nos) {
        const itemName = nameMap.get(itemNo) || '';
        const currentStock = stockAtDismiss.get(itemNo) ?? 0;

        // 기존 레코드 조회 (중복 대비 limit 없이 전체 조회)
        const { data: existingRows, error: findErr } = await supabase
          .from('inventory_alerts')
          .select('id')
          .eq('item_no', itemNo);

        if (findErr) {
          console.error(`Dismiss find error for ${itemNo}:`, findErr);
          errors.push(`${itemNo}: ${findErr.message}`);
          continue;
        }

        if (existingRows && existingRows.length > 0) {
          // 모든 중복 레코드를 한번에 dismissed로 업데이트 + 재고 스냅샷 저장
          const { error: updErr } = await supabase
            .from('inventory_alerts')
            .update({
              status: 'dismissed',
              dismissed_at: now,
              current_stock: currentStock,
              ...(itemName ? { item_name: itemName } : {}),
            })
            .eq('item_no', itemNo);
          if (updErr) {
            console.error(`Dismiss update error for ${itemNo}:`, updErr);
            errors.push(`${itemNo}: ${updErr.message}`);
          }
        } else {
          const { error: insErr } = await supabase
            .from('inventory_alerts')
            .insert({
              item_no: itemNo,
              item_name: itemName,
              alert_type: 'out_of_stock',
              current_stock: currentStock,
              threshold: 0,
              affected_clients: [],
              status: 'dismissed',
              dismissed_at: now,
            });
          if (insErr) {
            console.error(`Dismiss insert error for ${itemNo}:`, insErr);
            errors.push(`${itemNo}: ${insErr.message}`);
          }
        }
      }
      if (errors.length > 0) {
        return NextResponse.json({ success: false, error: errors.join('; '), dismissed: item_nos.length - errors.length }, { status: 500 });
      }
      return NextResponse.json({ success: true, dismissed: item_nos.length });
    }

    if (action === 'restore') {
      const { error: delErr } = await supabase
        .from('inventory_alerts')
        .delete()
        .in('item_no', item_nos)
        .eq('status', 'dismissed');
      if (delErr) {
        console.error('Restore delete error:', delErr);
        return NextResponse.json({ success: false, error: delErr.message }, { status: 500 });
      }
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

// ── GET: 제외된 품목 목록 조회 ──
export async function GET() {
  try {
    const { data: dismissed } = await supabase
      .from('inventory_alerts')
      .select('id, item_no, item_name, dismissed_at, created_at')
      .eq('status', 'dismissed')
      .order('dismissed_at', { ascending: false });

    if (!dismissed || dismissed.length === 0) {
      return NextResponse.json({ items: [], total: 0 });
    }

    // 재고 및 와인 정보 조회
    const itemNos = dismissed.map(d => d.item_no);
    const [{ data: invData }, { data: wineData }] = await Promise.all([
      supabase.from('inventory_cdv').select('item_no, item_name, country, supply_price, available_stock, bonded_warehouse').in('item_no', itemNos),
      supabase.from('wines').select('item_code, item_name_kr, country, wine_type, region').in('item_code', itemNos),
    ]);

    const invMap = new Map<string, any>();
    for (const inv of invData || []) invMap.set(inv.item_no, inv);
    const wineMap = new Map<string, any>();
    for (const w of wineData || []) wineMap.set(w.item_code, w);

    const items = dismissed.map(d => {
      const inv = invMap.get(d.item_no);
      const wine = wineMap.get(d.item_no);
      const totalStock = inv ? (inv.available_stock || 0) + (inv.bonded_warehouse || 0) : 0;
      return {
        id: d.id,
        item_no: d.item_no,
        item_name: wine?.item_name_kr || inv?.item_name || d.item_name || d.item_no,
        country: wine?.country || inv?.country || '',
        wine_type: wine?.wine_type || '',
        supply_price: inv?.supply_price || 0,
        current_stock: totalStock,
        dismissed_at: d.dismissed_at || d.created_at,
      };
    });

    return NextResponse.json({ items, total: items.length });
  } catch (error) {
    console.error('Alerts GET error:', error);
    return NextResponse.json(
      { error: '제외 목록 조회 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
