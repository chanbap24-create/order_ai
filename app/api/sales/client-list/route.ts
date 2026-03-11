import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const manager = sp.get('manager') || '';
  const startDate = sp.get('start') || '';
  const endDate = sp.get('end') || '';
  const businessType = sp.get('business_type') || '';
  const type = sp.get('type') || 'wine';

  if (!manager) {
    return NextResponse.json({ error: '담당자를 지정해주세요.' }, { status: 400 });
  }

  try {
    const table = type === 'glass' ? 'glass_shipments' : 'shipments';

    // 1) 기간 내 출고 데이터 조회
    let q = supabase
      .from(table)
      .select('client_code, client_name, business_type, supply_amount, total_amount, quantity, ship_date')
      .eq('manager', manager);
    if (startDate) q = q.gte('ship_date', startDate);
    if (endDate) q = q.lte('ship_date', endDate);
    if (businessType) q = q.eq('business_type', businessType);

    const { data: allRows, error: allErr } = await q;
    if (allErr) throw allErr;

    // JS에서 거래처별 집계
    const clientMap = new Map<string, {
      client_code: string;
      client_name: string;
      business_type: string;
      period_supply: number;
      period_total: number;
      period_qty: number;
      order_days: Set<string>;
    }>();

    for (const row of (allRows || [])) {
      const key = row.client_code || row.client_name;
      if (!clientMap.has(key)) {
        clientMap.set(key, {
          client_code: row.client_code || '',
          client_name: row.client_name || '',
          business_type: row.business_type || '',
          period_supply: 0,
          period_total: 0,
          period_qty: 0,
          order_days: new Set(),
        });
      }
      const c = clientMap.get(key)!;
      c.period_supply += (row.supply_amount || 0);
      c.period_total += (row.total_amount || 0);
      c.period_qty += (row.quantity || 0);
      if (row.ship_date) c.order_days.add(row.ship_date);
    }

    // 2) 각 거래처의 최종 발주일 (전체 기간 기준)
    const clientCodes = [...clientMap.keys()].filter(k => k);
    const lastOrderMap = new Map<string, string>();

    if (clientCodes.length > 0) {
      const { data: lastRows } = await supabase
        .from(table)
        .select('client_code, client_name, ship_date')
        .eq('manager', manager)
        .in('client_code', clientCodes)
        .order('ship_date', { ascending: false });

      if (lastRows) {
        for (const r of lastRows) {
          const key = r.client_code || r.client_name;
          if (!lastOrderMap.has(key)) {
            lastOrderMap.set(key, r.ship_date);
          }
        }
      }
    }

    // 3) 결과 조합
    const clients = [...clientMap.values()].map(c => ({
      client_code: c.client_code,
      client_name: c.client_name,
      business_type: c.business_type,
      period_supply: Math.round(c.period_supply),
      period_total: Math.round(c.period_total),
      period_qty: c.period_qty,
      order_days: c.order_days.size,
      last_order_date: lastOrderMap.get(c.client_code || c.client_name) || '',
    }));

    clients.sort((a, b) => b.period_total - a.period_total);

    // 4) 업종 목록 (해당 담당자의 전체 업종)
    const { data: btRows } = await supabase
      .from(table)
      .select('business_type')
      .eq('manager', manager)
      .not('business_type', 'is', null)
      .not('business_type', 'eq', '');

    const businessTypes = [...new Set((btRows || []).map(r => r.business_type))].sort();

    return NextResponse.json({
      clients,
      businessTypes,
      totalClients: clients.length,
      totalSupply: clients.reduce((s, c) => s + c.period_supply, 0),
      totalAmount: clients.reduce((s, c) => s + c.period_total, 0),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
