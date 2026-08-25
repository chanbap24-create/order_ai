import { ERP_CUTOFF_DATE } from '@/app/lib/constants';
import { supabase } from '@/app/lib/db';

// 매출처원장 조회·잔액 계산 — app/api/sales/ledger/route.ts 에서 분리(동작 불변).
// 코드/이름 매칭 출고·수금 + 이월(carryover) 기준점 역산으로 기간 시작 잔액을 산출.

const CODE_RE = /^[A-Za-z0-9_-]{1,30}$/;
const sanitizeCode = (v: string) => (CODE_RE.test(v) ? v : '');

export interface LedgerParams {
  clientCode: string;
  clientType: 'wine' | 'glass';
  startDate: string;
  endDate: string;
  /** clientInfo 미발견 시 표시용 폴백 이름 */
  fallbackName?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

export async function buildLedger(p: LedgerParams) {
  const { startDate, endDate } = p;
  const safeClientCode = sanitizeCode(p.clientCode);
  const isGlass = p.clientType === 'glass';
  const table = isGlass ? 'glass_shipments' : 'shipments';
  const payTable = isGlass ? 'glass_payments' : 'payments';
  const carryoverTable = isGlass ? 'glass_client_carryover' : 'client_carryover';

  // 거래처 정보 + 이름 확인
  // glass: 이월미수금(carryover) 행이 없는 거래처는 이름이 누락되므로 glass_clients(마스터)로 fallback
  let clientInfo: Row = null;
  if (isGlass) {
    const { data: co } = await supabase.from('glass_client_carryover')
      .select('client_code, client_name, carryover_amount').eq('client_code', safeClientCode).maybeSingle();
    if (co?.client_name) clientInfo = co;
    else {
      const { data: gc } = await supabase.from('glass_clients')
        .select('client_code, client_name').eq('client_code', safeClientCode).maybeSingle();
      clientInfo = gc ?? co ?? null;
    }
  } else {
    const { data } = await supabase.from('client_details')
      .select('client_code, client_name, client_type, manager, importance, business_type').eq('client_code', safeClientCode).maybeSingle();
    clientInfo = data;
  }

  const clientName = clientInfo?.client_name || p.fallbackName || '';

  // 같은 거래처명의 모든 코드 수집 (가벼운 테이블에서만). sibling code 도 화이트리스트 통과 강제.
  const allCodes: string[] = [safeClientCode].filter(Boolean);
  if (clientName) {
    const detailTable = isGlass ? 'glass_client_carryover' : 'client_details';
    const { data: siblings } = await supabase.from(detailTable).select('client_code').eq('client_name', clientName);
    if (siblings) for (const s of siblings) {
      const c = sanitizeCode(s.client_code || '');
      if (c && !allCodes.includes(c)) allCodes.push(c);
    }
  }

  const batch = 1000;

  // 병렬 조회: 출고(코드) + 출고(이름) + 수금(코드) + 수금(이름) + 이월
  const fetchAllShipments = async () => {
    const rows: Row[] = [];
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
    const rows: Row[] = [];
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
    const rows: Row[] = [];
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
    const rows: Row[] = [];
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
  if (isGlass) {
    // 글라스: 2025-08 전산이관 시점이 이월 기준일. carryover.created_at 은 DB insert 시각이라
    // 재동기화로 달라질 수 있어(예: 2026-02-24) 신뢰 불가 → 이관일 2025-08-01 로 고정.
    // 옛 출고(2025-08 이전)는 이월에 반영돼 있으므로 이 기준이 이중계상을 막는다.
    refDate = ERP_CUTOFF_DATE;
  } else if (carryResult.earliestCreatedAt) {
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
    const [s, pay] = await Promise.all([
      sumShipments(refDate, startDate),
      sumPayments(refDate, startDate),
    ]);
    // 순방향: 잔액 = carryover + sales - payments
    adjSales = -s;
    adjPay = -pay;
  }

  const rawRows = [...codeShips, ...nameShips];
  if (nameShips.length > 0) {
    rawRows.sort((a, b) => a.ship_date.localeCompare(b.ship_date) || (a.item_name || '').localeCompare(b.item_name || ''));
  }

  // 원장 표시 필터:
  //  - 자재(item_no '9' 시작) 제외 — 와인/글라스 거래와 별개 자재 거래
  //  - 무상/시음(selling_price=0 AND supply_amount=0) 제외 — 금액 0 거래는 원장 의미 X
  //  - 반품(quantity<0, supply_amount 음수) 은 자연스럽게 포함됨
  const allRows = rawRows.filter((r) => {
    const firstChar = (r.item_no || '').charAt(0).toUpperCase();
    if (firstChar === '9') return false;
    const sp = r.selling_price ?? 0;
    const sa = r.supply_amount ?? 0;
    if (sp === 0 && sa === 0) return false;
    return true;
  });

  const paymentRows = [...codePays, ...namePays];
  // 역산/순산: carryover 기준점에서 startDate까지의 잔액 산출
  const prevBalance = carryover - adjSales + adjPay;

  return {
    client: clientInfo || { client_code: p.clientCode, client_name: p.clientCode },
    rows: allRows,
    payments: paymentRows,
    prev_balance: prevBalance,
    total_rows: allRows.length,
    matched_codes: allCodes,
  };
}
