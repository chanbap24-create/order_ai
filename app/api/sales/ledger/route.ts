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

    const isGlass = clientType === 'glass';
    const table = isGlass ? 'glass_shipments' : 'shipments';
    const payTable = isGlass ? 'glass_payments' : 'payments';
    const carryoverTable = isGlass ? 'glass_client_carryover' : 'client_carryover';

    // 거래처 정보 + 이름 확인
    const { data: clientInfo } = isGlass
      ? await supabase.from('glass_client_carryover').select('client_code, client_name, carryover_amount').eq('client_code', clientCode).single()
      : await supabase.from('client_details').select('client_code, client_name, client_type, manager, importance, business_type').eq('client_code', clientCode).single();

    let clientName = clientInfo?.client_name || searchParams.get('client_name') || '';

    // 같은 거래처명의 모든 코드 수집 (가벼운 테이블에서만)
    const allCodes: string[] = [clientCode];
    if (clientName) {
      const detailTable = isGlass ? 'glass_client_carryover' : 'client_details';
      const { data: siblings } = await supabase.from(detailTable).select('client_code').eq('client_name', clientName);
      if (siblings) for (const s of siblings) if (!allCodes.includes(s.client_code)) allCodes.push(s.client_code);
    }

    const batch = 1000;

    // 병렬 조회: 출고(코드) + 출고(이름) + 수금(코드) + 수금(이름) + 이월
    const fetchAllShipments = async () => {
      const rows: any[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase.from(table)
          .select('ship_date, item_no, item_name, quantity, unit_price, supply_amount, tax_amount, total_amount, manager, warehouse, client_code, client_name')
          .in('client_code', allCodes).gte('ship_date', startDate).lte('ship_date', endDate)
          .order('ship_date', { ascending: true }).order('item_name', { ascending: true })
          .range(from, from + batch - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        rows.push(...data);
        if (data.length < batch) break;
        from += batch;
      }
      return rows;
    };

    const fetchNameShipments = async () => {
      if (!clientName) return [];
      const rows: any[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase.from(table)
          .select('ship_date, item_no, item_name, quantity, unit_price, supply_amount, tax_amount, total_amount, manager, warehouse, client_code, client_name')
          .eq('client_name', clientName).not('client_code', 'in', `(${allCodes.join(',')})`)
          .gte('ship_date', startDate).lte('ship_date', endDate)
          .order('ship_date', { ascending: true }).range(from, from + batch - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        rows.push(...data);
        if (data.length < batch) break;
        from += batch;
      }
      return rows;
    };

    const fetchAllPayments = async () => {
      const rows: any[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase.from(payTable)
          .select('client_code, client_name, payment_date, amount')
          .in('client_code', allCodes).gte('payment_date', startDate).lte('payment_date', endDate)
          .order('payment_date', { ascending: true }).range(from, from + batch - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        rows.push(...data);
        if (data.length < batch) break;
        from += batch;
      }
      return rows;
    };

    const fetchNamePayments = async () => {
      if (!clientName) return [];
      const rows: any[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase.from(payTable)
          .select('client_code, client_name, payment_date, amount')
          .eq('client_name', clientName).not('client_code', 'in', `(${allCodes.join(',')})`)
          .gte('payment_date', startDate).lte('payment_date', endDate)
          .order('payment_date', { ascending: true }).range(from, from + batch - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        rows.push(...data);
        if (data.length < batch) break;
        from += batch;
      }
      return rows;
    };

    const fetchCarryover = async () => {
      let carry = 0;
      const { data } = await supabase.from(carryoverTable).select('carryover_amount').in('client_code', allCodes);
      if (data) for (const c of data) carry += (c.carryover_amount || 0);
      if (clientName) {
        const { data: d2 } = await supabase.from(carryoverTable).select('carryover_amount')
          .eq('client_name', clientName).not('client_code', 'in', `(${allCodes.join(',')})`);
        if (d2) for (const c of d2) carry += (c.carryover_amount || 0);
      }
      return carry;
    };

    // 5개 쿼리 병렬 실행
    const [codeShips, nameShips, codePays, namePays, carryover] = await Promise.all([
      fetchAllShipments(), fetchNameShipments(), fetchAllPayments(), fetchNamePayments(), fetchCarryover(),
    ]);

    const allRows = [...codeShips, ...nameShips];
    if (nameShips.length > 0) {
      allRows.sort((a, b) => a.ship_date.localeCompare(b.ship_date) || (a.item_name || '').localeCompare(b.item_name || ''));
    }

    const prevTotal = carryover;
    const paymentRows = [...codePays, ...namePays];

    return NextResponse.json({
      client: clientInfo || { client_code: clientCode, client_name: clientCode },
      rows: allRows,
      payments: paymentRows,
      prev_balance: prevTotal,
      total_rows: allRows.length,
      matched_codes: allCodes,
    });
  } catch (err) {
    console.error('GET /api/sales/ledger error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
