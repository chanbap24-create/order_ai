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

    const clientName = clientInfo?.client_name || '';

    // 같은 거래처명의 모든 코드 수집
    const allCodes: string[] = [clientCode];
    if (clientName) {
      const { data: siblings } = await supabase
        .from('client_details')
        .select('client_code')
        .eq('client_name', clientName);
      if (siblings) {
        for (const s of siblings) {
          if (!allCodes.includes(s.client_code)) allCodes.push(s.client_code);
        }
      }
    }

    // client_name으로 직접 조회 (코드 불일치 문제 해결)
    const allRows: any[] = [];
    let from = 0;
    const batch = 1000;

    while (true) {
      // 코드 목록으로 조회
      const { data: d1, error: e1 } = await supabase
        .from(table)
        .select('ship_date, item_no, item_name, quantity, unit_price, supply_amount, tax_amount, total_amount, manager, warehouse, client_code, client_name')
        .in('client_code', allCodes)
        .gte('ship_date', startDate)
        .lte('ship_date', endDate)
        .order('ship_date', { ascending: true })
        .order('item_name', { ascending: true })
        .range(from, from + batch - 1);

      if (e1) throw e1;
      if (!d1 || d1.length === 0) break;
      allRows.push(...d1);
      if (d1.length < batch) break;
      from += batch;
    }

    // 이름 기반 추가 조회 (코드가 다르지만 이름이 같은 레코드)
    if (clientName) {
      const existingIds = new Set(allRows.map(r => `${r.ship_date}_${r.item_no}_${r.quantity}`));
      let nameFrom = 0;

      while (true) {
        const { data: d2, error: e2 } = await supabase
          .from(table)
          .select('ship_date, item_no, item_name, quantity, unit_price, supply_amount, tax_amount, total_amount, manager, warehouse, client_code, client_name')
          .eq('client_name', clientName)
          .not('client_code', 'in', `(${allCodes.join(',')})`)
          .gte('ship_date', startDate)
          .lte('ship_date', endDate)
          .order('ship_date', { ascending: true })
          .range(nameFrom, nameFrom + batch - 1);

        if (e2) throw e2;
        if (!d2 || d2.length === 0) break;
        allRows.push(...d2);
        if (d2.length < batch) break;
        nameFrom += batch;
      }

      // 날짜순 재정렬
      allRows.sort((a, b) => a.ship_date.localeCompare(b.ship_date) || (a.item_name || '').localeCompare(b.item_name || ''));
    }

    // 전월 이월 합계
    let prevTotal = 0;
    let prevFrom = 0;
    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select('supply_amount')
        .in('client_code', allCodes)
        .lt('ship_date', startDate)
        .range(prevFrom, prevFrom + batch - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const r of data) prevTotal += (r.supply_amount || 0);
      if (data.length < batch) break;
      prevFrom += batch;
    }

    // 이름 기반 전월 추가
    if (clientName) {
      let namePrevFrom = 0;
      while (true) {
        const { data, error } = await supabase
          .from(table)
          .select('supply_amount')
          .eq('client_name', clientName)
          .not('client_code', 'in', `(${allCodes.join(',')})`)
          .lt('ship_date', startDate)
          .range(namePrevFrom, namePrevFrom + batch - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const r of data) prevTotal += (r.supply_amount || 0);
        if (data.length < batch) break;
        namePrevFrom += batch;
      }
    }

    // 수금 내역 조회
    const paymentRows: any[] = [];
    let payFrom = 0;
    while (true) {
      const { data: pd, error: pe } = await supabase
        .from('payments')
        .select('client_code, client_name, payment_date, amount')
        .in('client_code', allCodes)
        .gte('payment_date', startDate)
        .lte('payment_date', endDate)
        .order('payment_date', { ascending: true })
        .range(payFrom, payFrom + batch - 1);

      if (pe) throw pe;
      if (!pd || pd.length === 0) break;
      paymentRows.push(...pd);
      if (pd.length < batch) break;
      payFrom += batch;
    }

    // 이름 기반 수금 추가 조회
    if (clientName) {
      let namePayFrom = 0;
      while (true) {
        const { data: pd2, error: pe2 } = await supabase
          .from('payments')
          .select('client_code, client_name, payment_date, amount')
          .eq('client_name', clientName)
          .not('client_code', 'in', `(${allCodes.join(',')})`)
          .gte('payment_date', startDate)
          .lte('payment_date', endDate)
          .order('payment_date', { ascending: true })
          .range(namePayFrom, namePayFrom + batch - 1);

        if (pe2) throw pe2;
        if (!pd2 || pd2.length === 0) break;
        paymentRows.push(...pd2);
        if (pd2.length < batch) break;
        namePayFrom += batch;
      }
    }

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
