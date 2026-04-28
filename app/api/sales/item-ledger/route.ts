import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { getSellingUnitPrice, getSellingTotal } from '@/app/lib/priceUtils';
import { isValidItemNo, isValidDate } from '@/app/lib/validators';

// GET: 품목별 판매현황 조회
// ?item_no=XXX&start_date=2025-01-01&end_date=2026-02-28&warehouse=CDV
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const itemNo = searchParams.get('item_no');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const warehouse = searchParams.get('warehouse') || 'CDV'; // CDV or DL

    if (!itemNo || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'item_no, start_date, end_date are required' },
        { status: 400 }
      );
    }

    // whitelist 검증
    if (!isValidItemNo(itemNo)) {
      return NextResponse.json({ error: 'Invalid item_no format' }, { status: 400 });
    }
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return NextResponse.json({ error: 'Invalid date format (YYYY-MM-DD)' }, { status: 400 });
    }
    if (warehouse !== 'CDV' && warehouse !== 'DL') {
      return NextResponse.json({ error: 'Invalid warehouse (CDV|DL)' }, { status: 400 });
    }

    const table = warehouse === 'DL' ? 'glass_shipments' : 'shipments';

    // 출고 데이터 조회
    const allRows: any[] = [];
    let from = 0;
    const batch = 1000;

    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select('ship_date, client_code, client_name, manager, department, quantity, unit_price, selling_price, supply_amount, tax_amount, total_amount')
        .eq('item_no', itemNo)
        .gte('ship_date', startDate)
        .lte('ship_date', endDate)
        .order('ship_date', { ascending: true })
        .range(from, from + batch - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;
      allRows.push(...data);
      if (data.length < batch) break;
      from += batch;
    }

    // 품목 정보 (wines 테이블에서)
    const { data: wineInfo } = await supabase
      .from('wines')
      .select('item_code, item_name_kr, item_name_en, vintage, country, region')
      .eq('item_code', itemNo)
      .maybeSingle();

    // 품목명 (shipments에서 가져오기)
    const itemName = allRows[0]?.item_name || wineInfo?.item_name_kr || itemNo;

    // 단가/금액 정규화: priceUtils 사용
    // 시기별 가격 컬럼 포맷 차이(2025-08 전후) → Q(판매단가)와 Q*수량(판매총액) 재계산.
    // 부호는 quantity 기준으로 통일 (반품이면 supply_amount 음수). 거래처별 집계에서
    // 평균단가가 반품으로 왜곡되지 않도록 핵심.
    for (const r of allRows) {
      const rawUp = r.unit_price;
      const rawSp = r.selling_price;
      const rawSa = r.supply_amount;
      const qty = r.quantity;
      const unitPrice = getSellingUnitPrice(rawUp, rawSp, rawSa, qty);
      const absTotal = Math.abs(getSellingTotal(rawUp, rawSp, rawSa, qty));
      const supplyTotal = qty < 0 ? -absTotal : absTotal;
      r.unit_price = unitPrice;
      r.supply_amount = supplyTotal;
      r.tax_amount = Math.round(supplyTotal * 0.1);
      r.total_amount = supplyTotal + r.tax_amount;
    }

    // 거래처별 집계
    const clientAgg = new Map<string, {
      client_name: string;
      total_qty: number;
      total_amount: number;
      avg_price: number;
      ship_count: number;
      last_date: string;
      first_date: string;
    }>();

    for (const r of allRows) {
      const key = r.client_name || r.client_code || 'unknown';
      if (!clientAgg.has(key)) {
        clientAgg.set(key, {
          client_name: r.client_name || r.client_code,
          total_qty: 0, total_amount: 0, avg_price: 0,
          ship_count: 0, last_date: '', first_date: r.ship_date,
        });
      }
      const agg = clientAgg.get(key)!;
      agg.total_qty += (r.quantity || 0);
      agg.total_amount += (r.supply_amount || 0);
      agg.ship_count += 1;
      if (r.ship_date > agg.last_date) agg.last_date = r.ship_date;
      if (r.ship_date < agg.first_date) agg.first_date = r.ship_date;
    }

    for (const agg of clientAgg.values()) {
      agg.avg_price = agg.total_qty !== 0 ? Math.round(agg.total_amount / agg.total_qty) : 0;
    }

    const clientSummary = Array.from(clientAgg.values())
      .sort((a, b) => b.total_amount - a.total_amount);

    // 총합계
    const totals = {
      qty: allRows.reduce((s, r) => s + (r.quantity || 0), 0),
      supply: allRows.reduce((s, r) => s + (r.supply_amount || 0), 0),
      clients: clientAgg.size,
    };

    return NextResponse.json({
      item_no: itemNo,
      item_name: itemName,
      wine_info: wineInfo || null,
      warehouse,
      rows: allRows,
      client_summary: clientSummary,
      totals,
      total_rows: allRows.length,
    });
  } catch (err) {
    console.error('GET /api/sales/item-ledger error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET: 품목 검색 (자동완성용)
// /api/sales/item-ledger?search=XXX&warehouse=CDV
