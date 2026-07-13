import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { getSellingUnitPrice, getSellingTotal } from '@/app/lib/priceUtils';

interface ShipRow {
  client_code: string;
  client_name: string;
  business_type: string;
  item_no: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  selling_price: number;
  supply_amount: number;
  tax_amount: number;
  total_amount: number;
  manager: string;
}

function groupByClient(rows: ShipRow[]) {
  const map = new Map<string, {
    client_code: string;
    client_name: string;
    business_type: string;
    supply_amount: number;
    tax_amount: number;
    total_amount: number;
    items: { item_no: string; item_name: string; quantity: number; unit_price: number; total_amount: number }[];
  }>();

  let totalSupply = 0, totalTax = 0, totalAmount = 0;

  for (const row of rows) {
    // 시기별 가격 컬럼 포맷 차이(2025-08 전후) 정규화
    // Q열(판매단가)과 Q*수량(판매총액)을 재계산 — 과거 기준단가(R) 표시 방지
    const qty = row.quantity || 0;
    const unitPrice = getSellingUnitPrice(row.unit_price, row.selling_price, row.supply_amount, qty);
    const supplyTotal = getSellingTotal(row.unit_price, row.selling_price, row.supply_amount, qty);
    const taxAmount = Math.round(supplyTotal * 0.1);
    const totalWithVat = supplyTotal + taxAmount;

    const key = row.client_code || row.client_name;
    if (!map.has(key)) {
      map.set(key, {
        client_code: row.client_code,
        client_name: row.client_name,
        business_type: row.business_type || '',
        supply_amount: 0, tax_amount: 0, total_amount: 0,
        items: [],
      });
    }
    const g = map.get(key)!;
    g.supply_amount += supplyTotal;
    g.tax_amount += taxAmount;
    g.total_amount += totalWithVat;
    g.items.push({
      item_no: row.item_no,
      item_name: row.item_name,
      quantity: qty,
      unit_price: unitPrice,
      total_amount: totalWithVat,
    });
    totalSupply += supplyTotal;
    totalTax += taxAmount;
    totalAmount += totalWithVat;
  }

  return {
    clients: Array.from(map.values()).sort((a, b) => b.total_amount - a.total_amount),
    totals: { supply: totalSupply, tax: totalTax, total: totalAmount },
    count: rows.length,
  };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const manager = sp.get('manager');
  const dateFrom = sp.get('date_from') || sp.get('date');
  const dateTo = sp.get('date_to') || dateFrom;

  // 기본: KST 오늘 (UTC+9)
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayDefault = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
  const from = (dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) ? dateFrom : todayDefault;
  const to = (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) ? dateTo : from;

  const cols = 'client_code, client_name, business_type, item_no, item_name, quantity, unit_price, selling_price, supply_amount, tax_amount, total_amount, manager';

  // 담당 스코프 = '현재 담당' 거래처 코드 (와인=client_details.manager · 글라스=glass_clients.manager).
  //   재배정 시 그 거래처의 과거 출고도 현재 담당 화면에 귀속(분석·매출분석과 동일 정책).
  const fetchManagerCodes = async (detailTable: string, wineOnly: boolean): Promise<string[]> => {
    const codes: string[] = [];
    for (let off = 0; off < 200000; off += 1000) {
      let q = supabase.from(detailTable).select('client_code').eq('manager', manager!);
      if (wineOnly) q = q.eq('client_type', 'wine');
      const { data, error } = await q.range(off, off + 999);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      for (const r of data) if (r.client_code) codes.push(r.client_code);
      if (data.length < 1000) break;
    }
    return codes;
  };

  // Supabase 1000행 캡 — '올해' 같은 긴 기간은 한 번에 잘리므로 id 기준 페이지네이션으로 전체 로드.
  // 담당 스코프는 코드 청크(.in)로 적용(코드가 많아 URL 길이 제한 회피).
  const fetchAllRows = async (table: string, codes: string[] | null): Promise<ShipRow[]> => {
    const chunks: (string[] | null)[] = [];
    if (codes === null) chunks.push(null);
    else for (let i = 0; i < codes.length; i += 150) chunks.push(codes.slice(i, i + 150));
    const rows: ShipRow[] = [];
    for (const chunk of chunks) {
      for (let off = 0; off < 200000; off += 1000) {
        let q = supabase.from(table).select(cols).gte('ship_date', from).lte('ship_date', to);
        if (chunk) q = q.in('client_code', chunk);
        const { data, error } = await q.order('id', { ascending: true }).range(off, off + 999);
        if (error) throw new Error(error.message);
        if (!data || data.length === 0) break;
        rows.push(...(data as unknown as ShipRow[]));
        if (data.length < 1000) break;
      }
    }
    return rows;
  };

  try {
    const scoped = !!manager && manager !== 'admin';
    const [wineCodes, glassCodes] = scoped
      ? await Promise.all([fetchManagerCodes('client_details', true), fetchManagerCodes('glass_clients', false)])
      : [null, null];
    const [wineRows, glassRows] = await Promise.all([
      fetchAllRows('shipments', wineCodes),
      fetchAllRows('glass_shipments', glassCodes),
    ]);
    const wine = groupByClient(wineRows);
    const glass = groupByClient(glassRows);
    return NextResponse.json({ wine, glass });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}
