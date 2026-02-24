import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

// GET: 매출처원장 조회
// ?client_code=XXX&start_date=2026-01-01&end_date=2026-02-28&type=wine
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientCode = searchParams.get('client_code');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const clientType = searchParams.get('type') || 'wine';

    if (!clientCode || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'client_code, start_date, end_date are required' },
        { status: 400 }
      );
    }

    const table = clientType === 'glass' ? 'glass_shipments' : 'shipments';

    // 거래처 정보
    const { data: clientInfo } = await supabase
      .from('client_details')
      .select('client_code, client_name, client_type, manager, importance, business_type')
      .eq('client_code', clientCode)
      .single();

    // 출고 데이터 조회 (페이지네이션)
    const allRows: any[] = [];
    let from = 0;
    const batch = 1000;

    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select('ship_date, item_no, item_name, quantity, unit_price, supply_amount, tax_amount, total_amount, manager, warehouse')
        .eq('client_code', clientCode)
        .gte('ship_date', startDate)
        .lte('ship_date', endDate)
        .order('ship_date', { ascending: true })
        .order('item_name', { ascending: true })
        .range(from, from + batch - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;
      allRows.push(...data);
      if (data.length < batch) break;
      from += batch;
    }

    // 전월 이월 합계 (start_date 이전 전체 매출)
    let prevTotal = 0;
    let prevFrom = 0;
    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select('supply_amount')
        .eq('client_code', clientCode)
        .lt('ship_date', startDate)
        .range(prevFrom, prevFrom + batch - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const r of data) prevTotal += (r.supply_amount || 0);
      if (data.length < batch) break;
      prevFrom += batch;
    }

    return NextResponse.json({
      client: clientInfo || { client_code: clientCode, client_name: clientCode },
      rows: allRows,
      prev_balance: prevTotal,
      total_rows: allRows.length,
    });
  } catch (err) {
    console.error('GET /api/sales/ledger error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
