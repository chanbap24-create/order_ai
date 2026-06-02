import { supabase } from '@/app/lib/db';

// PostgREST 필터 인젝션 방지
const sanitizeCode = (v: string) => v.replace(/[(),."\\]/g, '');

/**
 * 거래처 원장 데이터 조회:
 *  - 해당 거래처(+같은 이름 다른 코드)의 shipments + payments + carryover + 이월 미수금 조정.
 *  - wine/glass 분기(table name) 포함.
 *  - startDate가 carryover refDate보다 앞/뒤이면 그 구간 매출/수금으로 prevBalance 재계산.
 */
export async function fetchLedgerData(
  clientCode: string, startDate: string, endDate: string, clientType: string,
) {
  const table = clientType === 'glass' ? 'glass_shipments' : 'shipments';
  const payTable = clientType === 'glass' ? 'glass_payments' : 'payments';
  const carryoverTable = clientType === 'glass' ? 'glass_client_carryover' : 'client_carryover';
  const batch = 1000;

  const isGlass = clientType === 'glass';
  const safeClientCode = sanitizeCode(clientCode);

  // 거래처 정보 (이름)
  // glass: 이월미수금(carryover) 행이 없는 거래처는 이름이 누락되므로
  //        글라스 마스터(glass_clients) 로 fallback 한다. (wine 은 client_details 사용)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let clientInfo: any = null;
  if (isGlass) {
    const { data: co } = await supabase.from('glass_client_carryover')
      .select('client_code, client_name').eq('client_code', safeClientCode).maybeSingle();
    if (co?.client_name) clientInfo = co;
    else {
      const { data: gc } = await supabase.from('glass_clients')
        .select('client_code, client_name').eq('client_code', safeClientCode).maybeSingle();
      clientInfo = gc ?? null;
    }
  } else {
    const { data } = await supabase.from('client_details')
      .select('client_code, client_name, client_type, manager').eq('client_code', safeClientCode).maybeSingle();
    clientInfo = data;
  }

  const clientName = clientInfo?.client_name || '';

  // 같은 거래처명의 모든 코드
  const allCodes: string[] = [safeClientCode];
  if (clientName) {
    const detailTable = isGlass ? 'glass_client_carryover' : 'client_details';
    const { data: siblings } = await supabase.from(detailTable).select('client_code').eq('client_name', clientName);
    if (siblings) for (const s of siblings) if (!allCodes.includes(s.client_code)) allCodes.push(s.client_code);
  }

  // 출고 조회
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allRows: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from(table)
      .select('ship_date, item_no, item_name, quantity, unit_price, selling_price, supply_amount, tax_amount, total_amount, manager, warehouse, client_code, client_name')
      .in('client_code', allCodes).gte('ship_date', startDate).lte('ship_date', endDate)
      .order('ship_date', { ascending: true }).order('item_name', { ascending: true })
      .range(from, from + batch - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < batch) break;
    from += batch;
  }

  // 이름 기반 추가 조회
  if (clientName) {
    let nameFrom = 0;
    while (true) {
      const { data, error } = await supabase.from(table)
        .select('ship_date, item_no, item_name, quantity, unit_price, selling_price, supply_amount, tax_amount, total_amount, manager, warehouse, client_code, client_name')
        .eq('client_name', clientName).not('client_code', 'in', `(${allCodes.map(sanitizeCode).join(',')})`)
        .gte('ship_date', startDate).lte('ship_date', endDate)
        .order('ship_date', { ascending: true }).range(nameFrom, nameFrom + batch - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allRows.push(...data);
      if (data.length < batch) break;
      nameFrom += batch;
    }
    allRows.sort((a, b) => a.ship_date.localeCompare(b.ship_date) || (a.item_name || '').localeCompare(b.item_name || ''));
  }

  // 이월 미수금 (created_at 포함 — refDate 결정에 필요)
  let carryover = 0;
  let earliestCreatedAt: string | null = null;
  const { data: co } = await supabase.from(carryoverTable).select('carryover_amount, created_at').in('client_code', allCodes);
  if (co) for (const c of co) {
    carryover += (c.carryover_amount || 0);
    if (c.created_at && (!earliestCreatedAt || c.created_at < earliestCreatedAt)) earliestCreatedAt = c.created_at;
  }
  if (clientName) {
    const { data: coName } = await supabase.from(carryoverTable).select('carryover_amount, created_at')
      .eq('client_name', clientName).not('client_code', 'in', `(${allCodes.map(sanitizeCode).join(',')})`);
    if (coName) for (const c of coName) {
      carryover += (c.carryover_amount || 0);
      if (c.created_at && (!earliestCreatedAt || c.created_at < earliestCreatedAt)) earliestCreatedAt = c.created_at;
    }
  }

  // carryover 기준월: created_at KST 월초 (또는 2020-01-01 fallback)
  // 글라스는 2025-08 전산이관 시점이 이월 기준 → created_at(재동기화로 변동) 대신 고정.
  let refDate: string;
  if (isGlass) {
    refDate = '2025-08-01';
  } else if (earliestCreatedAt) {
    const d = new Date(earliestCreatedAt);
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    refDate = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-01`;
  } else {
    refDate = '2020-01-01';
  }

  let prevBalance = carryover;
  if (startDate < refDate) {
    let adjSales = 0, adjPay = 0;
    let af = 0;
    while (true) {
      const { data, error } = await supabase.from(table).select('total_amount')
        .in('client_code', allCodes).gte('ship_date', startDate).lt('ship_date', refDate)
        .range(af, af + batch - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const r of data) adjSales += (r.total_amount || 0);
      if (data.length < batch) break;
      af += batch;
    }
    af = 0;
    while (true) {
      const { data, error } = await supabase.from(payTable).select('amount')
        .in('client_code', allCodes).gte('payment_date', startDate).lt('payment_date', refDate)
        .range(af, af + batch - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const r of data) adjPay += (r.amount || 0);
      if (data.length < batch) break;
      af += batch;
    }
    prevBalance = carryover - adjSales + adjPay;
  } else if (startDate > refDate) {
    let adjSales = 0, adjPay = 0;
    let af = 0;
    while (true) {
      const { data, error } = await supabase.from(table).select('total_amount')
        .in('client_code', allCodes).gte('ship_date', refDate).lt('ship_date', startDate)
        .range(af, af + batch - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const r of data) adjSales += (r.total_amount || 0);
      if (data.length < batch) break;
      af += batch;
    }
    af = 0;
    while (true) {
      const { data, error } = await supabase.from(payTable).select('amount')
        .in('client_code', allCodes).gte('payment_date', refDate).lt('payment_date', startDate)
        .range(af, af + batch - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const r of data) adjPay += (r.amount || 0);
      if (data.length < batch) break;
      af += batch;
    }
    prevBalance = carryover + adjSales - adjPay;
  }

  // 수금 내역
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payments: any[] = [];
  let payFrom = 0;
  while (true) {
    const { data, error } = await supabase.from(payTable)
      .select('client_code, client_name, payment_date, amount')
      .in('client_code', allCodes).gte('payment_date', startDate).lte('payment_date', endDate)
      .order('payment_date', { ascending: true }).range(payFrom, payFrom + batch - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    payments.push(...data);
    if (data.length < batch) break;
    payFrom += batch;
  }

  // 이름 기반 수금
  if (clientName) {
    let npf = 0;
    while (true) {
      const { data, error } = await supabase.from(payTable)
        .select('client_code, client_name, payment_date, amount')
        .eq('client_name', clientName).not('client_code', 'in', `(${allCodes.map(sanitizeCode).join(',')})`)
        .gte('payment_date', startDate).lte('payment_date', endDate)
        .order('payment_date', { ascending: true }).range(npf, npf + batch - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      payments.push(...data);
      if (data.length < batch) break;
      npf += batch;
    }
  }

  // 이름 최종 안전망: 마스터에 없어도 출고 row 의 거래처명을 사용 (코드만 나오는 문제 방지)
  const resolvedName = clientInfo?.client_name || allRows[0]?.client_name || clientCode;
  return {
    client: { ...(clientInfo || {}), client_code: clientCode, client_name: resolvedName },
    rows: allRows, payments, prevBalance,
  };
}
