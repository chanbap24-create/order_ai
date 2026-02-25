import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

const CUTOFF = '2025-08-01';

// GET /api/sales/outstanding?manager=XXX&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&type=wine
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const manager = searchParams.get('manager');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const clientType = searchParams.get('type') || 'wine';

    if (!manager || !startDate || !endDate) {
      return NextResponse.json({ error: 'manager, start_date, end_date required' }, { status: 400 });
    }

    const table = clientType === 'glass' ? 'glass_shipments' : 'shipments';
    const payTable = clientType === 'glass' ? 'glass_payments' : 'payments';
    const carryoverTable = clientType === 'glass' ? 'glass_client_carryover' : 'client_carryover';

    // 1. 담당자의 거래처 목록
    const { data: clientList, error: clErr } = await supabase
      .from('client_details')
      .select('client_code, client_name')
      .eq('manager', manager);
    if (clErr) throw clErr;
    if (!clientList || clientList.length === 0) {
      return NextResponse.json({ clients: [] });
    }

    // (X), (x) 접두어 거래처 제외 (폐업/철수)
    // client_code가 숫자 코드가 아닌 이름 기반인 것도 제외 (URL 길이 제한 방지)
    const activeClients = clientList.filter(c => {
      if (/^\(x\)/i.test(c.client_name || '')) return false;
      if (c.client_code === c.client_name) return false; // 이름 기반 코드 제외
      return true;
    });

    // client_name별 코드 그룹핑
    const nameToCodesMap = new Map<string, string[]>();
    for (const c of activeClients) {
      const name = c.client_name || c.client_code;
      if (!nameToCodesMap.has(name)) nameToCodesMap.set(name, []);
      nameToCodesMap.get(name)!.push(c.client_code);
    }

    const allCodes = activeClients.map(c => c.client_code);

    // 2. 이월 미수금 일괄 조회
    const carryoverMap = new Map<string, number>();
    {
      const batch = 500;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from(carryoverTable)
          .select('client_code, carryover_amount')
          .in('client_code', allCodes)
          .range(from, from + batch - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const r of data) {
          carryoverMap.set(r.client_code, (carryoverMap.get(r.client_code) || 0) + (r.carryover_amount || 0));
        }
        if (data.length < batch) break;
        from += batch;
      }
    }

    // 3. 이전 판매액 (CUTOFF ~ startDate) - 전월미수용
    const prevSalesMap = new Map<string, number>();
    {
      const batch = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from(table)
          .select('client_code, total_amount')
          .in('client_code', allCodes)
          .gte('ship_date', CUTOFF)
          .lt('ship_date', startDate)
          .range(from, from + batch - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const r of data) {
          prevSalesMap.set(r.client_code, (prevSalesMap.get(r.client_code) || 0) + (r.total_amount || 0));
        }
        if (data.length < batch) break;
        from += batch;
      }
    }

    // 4. 이전 수금 (~ startDate)
    const prevPayMap = new Map<string, number>();
    {
      const batch = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from(payTable)
          .select('client_code, amount')
          .in('client_code', allCodes)
          .lt('payment_date', startDate)
          .range(from, from + batch - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const r of data) {
          prevPayMap.set(r.client_code, (prevPayMap.get(r.client_code) || 0) + (r.amount || 0));
        }
        if (data.length < batch) break;
        from += batch;
      }
    }

    // 5. 당기간 판매 (startDate ~ endDate)
    const periodSalesMap = new Map<string, { supply: number; tax: number; total: number }>();
    {
      const batch = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from(table)
          .select('client_code, supply_amount, tax_amount, total_amount')
          .in('client_code', allCodes)
          .gte('ship_date', startDate)
          .lte('ship_date', endDate)
          .range(from, from + batch - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const r of data) {
          const cur = periodSalesMap.get(r.client_code) || { supply: 0, tax: 0, total: 0 };
          cur.supply += r.supply_amount || 0;
          cur.tax += r.tax_amount || 0;
          cur.total += r.total_amount || 0;
          periodSalesMap.set(r.client_code, cur);
        }
        if (data.length < batch) break;
        from += batch;
      }
    }

    // 6. 당기간 수금 (startDate ~ endDate)
    const periodPayMap = new Map<string, number>();
    {
      const batch = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from(payTable)
          .select('client_code, amount')
          .in('client_code', allCodes)
          .gte('payment_date', startDate)
          .lte('payment_date', endDate)
          .range(from, from + batch - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const r of data) {
          periodPayMap.set(r.client_code, (periodPayMap.get(r.client_code) || 0) + (r.amount || 0));
        }
        if (data.length < batch) break;
        from += batch;
      }
    }

    // 7. 거래처명별 집계
    const clients: {
      client_code: string;
      client_name: string;
      prev_balance: number;
      period_supply: number;
      period_tax: number;
      period_total: number;
      period_payment: number;
      outstanding: number;
    }[] = [];

    for (const [name, codes] of nameToCodesMap) {
      let carryover = 0, prevSales = 0, prevPay = 0;
      let pSupply = 0, pTax = 0, pTotal = 0, pPayment = 0;

      for (const code of codes) {
        carryover += carryoverMap.get(code) || 0;
        prevSales += prevSalesMap.get(code) || 0;
        prevPay += prevPayMap.get(code) || 0;
        const ps = periodSalesMap.get(code);
        if (ps) { pSupply += ps.supply; pTax += ps.tax; pTotal += ps.total; }
        pPayment += periodPayMap.get(code) || 0;
      }

      const prevBalance = carryover + prevSales - prevPay;
      const outstanding = prevBalance + pTotal - pPayment;

      // 미수금 0이고 기간 내 거래도 없으면 제외
      const hasActivity = pTotal !== 0 || pPayment !== 0;
      if (outstanding === 0 && !hasActivity) continue;

      clients.push({
        client_code: codes[0],
        client_name: name,
        prev_balance: prevBalance,
        period_supply: pSupply,
        period_tax: pTax,
        period_total: pTotal,
        period_payment: pPayment,
        outstanding,
      });
    }

    // 미수금 높은순 정렬
    clients.sort((a, b) => b.outstanding - a.outstanding);

    return NextResponse.json({ clients });
  } catch (err) {
    console.error('GET /api/sales/outstanding error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
