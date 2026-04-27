import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { isValidClientCode, isValidDate } from '@/app/lib/validators';
import { requireClientAccess } from '@/app/lib/authz';

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

    // 입력값 whitelist 검증
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return NextResponse.json({ error: 'Invalid date format (YYYY-MM-DD)' }, { status: 400 });
    }
    if (!isValidClientCode(clientCode)) {
      return NextResponse.json({ error: 'Invalid client_code format' }, { status: 400 });
    }
    if (clientType !== 'wine' && clientType !== 'glass') {
      return NextResponse.json({ error: 'Invalid type (wine|glass)' }, { status: 400 });
    }

    // IDOR 방어: 본인 거래처만 접근 (wine/glass 코드 충돌 회피를 위해 type 전달)
    const accessCheck = await requireClientAccess(clientCode, clientType as 'wine' | 'glass');
    if (accessCheck) return accessCheck;

    // PostgREST 필터 인젝션 방지: .not('in', ...) 문자열에 사용되는 값 sanitize
    const sanitizeCode = (v: string) => v.replace(/[(),."\\]/g, '');
    const safeClientCode = sanitizeCode(clientCode);

    const isGlass = clientType === 'glass';
    const table = isGlass ? 'glass_shipments' : 'shipments';
    const payTable = isGlass ? 'glass_payments' : 'payments';
    const carryoverTable = isGlass ? 'glass_client_carryover' : 'client_carryover';

    // 거래처 정보 + 이름 확인
    const { data: clientInfo } = isGlass
      ? await supabase.from('glass_client_carryover').select('client_code, client_name, carryover_amount').eq('client_code', safeClientCode).single()
      : await supabase.from('client_details').select('client_code, client_name, client_type, manager, importance, business_type').eq('client_code', safeClientCode).single();

    let clientName = clientInfo?.client_name || searchParams.get('client_name') || '';

    // 같은 거래처명의 모든 코드 수집 (가벼운 테이블에서만)
    const allCodes: string[] = [safeClientCode];
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
          .select('ship_date, item_no, item_name, quantity, unit_price, selling_price, supply_amount, tax_amount, total_amount, manager, warehouse, client_code, client_name')
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
          .select('ship_date, item_no, item_name, quantity, unit_price, selling_price, supply_amount, tax_amount, total_amount, manager, warehouse, client_code, client_name')
          .eq('client_name', clientName).not('client_code', 'in', `(${allCodes.map(sanitizeCode).join(',')})`)
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
          .eq('client_name', clientName).not('client_code', 'in', `(${allCodes.map(sanitizeCode).join(',')})`)
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
      let earliestCreatedAt: string | null = null;
      const { data } = await supabase.from(carryoverTable).select('carryover_amount, created_at').in('client_code', allCodes);
      if (data) for (const c of data) {
        carry += (c.carryover_amount || 0);
        if (c.created_at && (!earliestCreatedAt || c.created_at < earliestCreatedAt)) earliestCreatedAt = c.created_at;
      }
      if (clientName) {
        const { data: d2 } = await supabase.from(carryoverTable).select('carryover_amount, created_at')
          .eq('client_name', clientName).not('client_code', 'in', `(${allCodes.map(sanitizeCode).join(',')})`);
        if (d2) for (const c of d2) {
          carry += (c.carryover_amount || 0);
          if (c.created_at && (!earliestCreatedAt || c.created_at < earliestCreatedAt)) earliestCreatedAt = c.created_at;
        }
      }
      return { carry, earliestCreatedAt };
    };

    // 6개 쿼리 병렬 실행 (adjustment는 carryover 결과 필요하므로 이후 실행)
    const [codeShips, nameShips, codePays, namePays, carryResult] = await Promise.all([
      fetchAllShipments(), fetchNameShipments(), fetchAllPayments(), fetchNamePayments(), fetchCarryover(),
    ]);

    const carryover = carryResult.carry;

    // carryover 기준월 결정: 최초 created_at 월의 1일 (carryover = 해당 월 시작 잔액)
    // KST(UTC+9) 기준으로 날짜 파싱 — Vercel(UTC) 환경에서도 정확한 한국 날짜 사용
    let refDate: string;
    if (carryResult.earliestCreatedAt) {
      const d = new Date(carryResult.earliestCreatedAt);
      const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
      refDate = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-01`;
    } else {
      // carryover 레코드 없음: 모든 과거 거래를 순방향으로 합산하기 위해 충분히 이른 날짜 사용
      refDate = '2020-01-01';
    }

    // 과거/미래 월 조회 시 startDate ↔ refDate 구간의 매출/수금을 역산
    // shipments / payments 페이지네이션은 서로 독립적이므로 병렬 수행
    async function sumShipments(fromDate: string, toDate: string) {
      let total = 0;
      let from = 0;
      while (true) {
        const { data, error } = await supabase.from(table).select('total_amount')
          .in('client_code', allCodes).gte('ship_date', fromDate).lt('ship_date', toDate)
          .range(from, from + batch - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const r of data) total += (r.total_amount || 0);
        if (data.length < batch) break;
        from += batch;
      }
      return total;
    }
    async function sumPayments(fromDate: string, toDate: string) {
      let total = 0;
      let from = 0;
      while (true) {
        const { data, error } = await supabase.from(payTable).select('amount')
          .in('client_code', allCodes).gte('payment_date', fromDate).lt('payment_date', toDate)
          .range(from, from + batch - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const r of data) total += (r.amount || 0);
        if (data.length < batch) break;
        from += batch;
      }
      return total;
    }

    let adjSales = 0, adjPay = 0;
    if (startDate < refDate) {
      [adjSales, adjPay] = await Promise.all([
        sumShipments(startDate, refDate),
        sumPayments(startDate, refDate),
      ]);
    } else if (startDate > refDate) {
      const [s, p] = await Promise.all([
        sumShipments(refDate, startDate),
        sumPayments(refDate, startDate),
      ]);
      // 순방향: 잔액 = carryover + sales - payments
      adjSales = -s;
      adjPay = -p;
    }

    const allRows = [...codeShips, ...nameShips];
    if (nameShips.length > 0) {
      allRows.sort((a, b) => a.ship_date.localeCompare(b.ship_date) || (a.item_name || '').localeCompare(b.item_name || ''));
    }

    const paymentRows = [...codePays, ...namePays];
    // 역산/순산: carryover 기준점에서 startDate까지의 잔액 산출
    const prevBalance = carryover - adjSales + adjPay;

    return NextResponse.json({
      client: clientInfo || { client_code: clientCode, client_name: clientCode },
      rows: allRows,
      payments: paymentRows,
      prev_balance: prevBalance,
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
