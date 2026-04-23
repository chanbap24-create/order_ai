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

  let wineQuery = supabase.from('shipments').select(cols).gte('ship_date', from).lte('ship_date', to).limit(10000);
  let glassQuery = supabase.from('glass_shipments').select(cols).gte('ship_date', from).lte('ship_date', to).limit(10000);

  if (manager && manager !== 'admin') {
    wineQuery = wineQuery.eq('manager', manager);
    glassQuery = glassQuery.eq('manager', manager);
  }

  const [wineRes, glassRes] = await Promise.all([wineQuery, glassQuery]);

  if (wineRes.error) return NextResponse.json({ error: wineRes.error.message }, { status: 500 });
  if (glassRes.error) return NextResponse.json({ error: glassRes.error.message }, { status: 500 });

  const wine = groupByClient((wineRes.data || []) as ShipRow[]);
  const glass = groupByClient((glassRes.data || []) as ShipRow[]);

  return NextResponse.json({ wine, glass });
}
