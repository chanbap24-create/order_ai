import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

export async function GET(request: NextRequest) {
  try {
    const p = request.nextUrl.searchParams;
    const tab = p.get('tab') || 'CDV';
    const table = tab === 'DL' ? 'inventory_dl' : 'inventory_cdv';

    const stockMin = p.get('stockMin');
    const sales30Max = p.get('sales30Max');
    const sales90Max = p.get('sales90Max');
    const vintageVal = p.get('vintage');
    const vintageOp = p.get('vintageOp') || 'gte';
    const supplyPriceVal = p.get('supplyPrice');
    const supplyPriceOp = p.get('supplyPriceOp') || 'gte';
    const retailPriceVal = p.get('retailPrice');
    const retailPriceOp = p.get('retailPriceOp') || 'gte';
    const q = p.get('q') || '';

    let query = supabase.from(table).select('*');

    // Text search (optional)
    if (q.trim()) {
      const safe = q.trim().toLowerCase().replace(/[%_]/g, '');
      query = query.or(`item_name.ilike.%${safe}%,item_no.ilike.%${safe}%`);
    }

    // Supply price filter
    if (supplyPriceVal) {
      const v = Number(supplyPriceVal);
      if (supplyPriceOp === 'gte') query = query.gte('supply_price', v);
      else query = query.lte('supply_price', v);
    }

    // Retail price filter
    if (retailPriceVal) {
      const v = Number(retailPriceVal);
      if (retailPriceOp === 'gte') query = query.gte('retail_price', v);
      else query = query.lte('retail_price', v);
    }

    // Vintage filter (text column - cast comparison)
    if (vintageVal) {
      const v = vintageVal;
      if (vintageOp === 'gte') query = query.gte('vintage', v);
      else query = query.lte('vintage', v);
    }

    // 30-day sales filter
    if (sales30Max) {
      query = query.lte('sales_30days', Number(sales30Max));
    }

    // 90-day avg sales filter
    if (sales90Max) {
      query = query.lte('avg_sales_90d', Number(sales90Max));
    }

    query = query.order('supply_price', { ascending: false }).limit(500);

    const { data, error } = await query;
    if (error) throw error;

    // Stock min filter (available_stock + bonded_warehouse) - done in JS
    let results = data || [];
    if (stockMin) {
      const min = Number(stockMin);
      results = results.filter((r: any) => {
        const total = (r.available_stock || 0) + (r.bonded_warehouse || 0);
        return total >= min;
      });
    }

    return NextResponse.json({ results, count: results.length });
  } catch (error) {
    console.error('Inventory filter error:', error);
    return NextResponse.json(
      { error: '필터 검색 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
