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

    // 거래처 정보
    const { data: clientInfo } = await supabase
      .from('client_details')
      .select('client_code, client_name, client_type, manager, importance, business_type')
      .eq('client_code', clientCode)
      .single();

    // Glass: client_details에 없으면 client_code를 client_name으로 간주
    let clientName = clientInfo?.client_name || '';
    if (isGlass && !clientName) {
      // client_code가 실제로는 client_name일 수 있음 (outstanding에서 name 기반으로 넘김)
      clientName = searchParams.get('client_name') || clientCode;
    }

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
      // Glass: shipments/payments에서도 코드 수집
      if (isGlass) {
        const { data: shipCodes } = await supabase
          .from('glass_shipments')
          .select('client_code')
          .eq('client_name', clientName)
          .not('client_code', 'is', null)
          .limit(100);
        for (const s of (shipCodes || [])) {
          if (s.client_code && !allCodes.includes(s.client_code)) allCodes.push(s.client_code);
        }
        const { data: payCodes } = await supabase
          .from('glass_payments')
          .select('client_code')
          .eq('client_name', clientName)
          .not('client_code', 'is', null)
          .limit(100);
        for (const s of (payCodes || [])) {
          if (s.client_code && !allCodes.includes(s.client_code)) allCodes.push(s.client_code);
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

    // 이월 미수금 조회 (25년 7월 이전 잔액)
    let carryover = 0;
    const { data: carryoverData } = await supabase
      .from(carryoverTable)
      .select('carryover_amount')
      .in('client_code', allCodes);
    if (carryoverData) {
      for (const c of carryoverData) carryover += (c.carryover_amount || 0);
    }

    // 이름 기반 이월 추가
    if (clientName) {
      const { data: carryoverName } = await supabase
        .from(carryoverTable)
        .select('carryover_amount')
        .eq('client_name', clientName)
        .not('client_code', 'in', `(${allCodes.join(',')})`);
      if (carryoverName) {
        for (const c of carryoverName) carryover += (c.carryover_amount || 0);
      }
    }

    // 이월잔액 = carryover (이미 조회기간 시작 전까지의 전체 미수잔액 포함)
    const prevTotal = carryover;

    // 수금 내역 조회
    const paymentRows: any[] = [];
    let payFrom = 0;
    while (true) {
      const { data: pd, error: pe } = await supabase
        .from(payTable)
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
          .from(payTable)
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
