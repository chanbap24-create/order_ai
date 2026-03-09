import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

export async function GET(request: NextRequest) {
  try {
    const p = request.nextUrl.searchParams;
    const tab = p.get('tab') || 'CDV';
    const table = tab === 'DL' ? 'inventory_dl' : 'inventory_cdv';
    const q = p.get('q') || '';

    // Range params
    const stockMin = p.get('stockMin');
    const stockMax = p.get('stockMax');
    const sales30Min = p.get('sales30Min');
    const sales30Max = p.get('sales30Max');
    const sales90Min = p.get('sales90Min');
    const sales90Max = p.get('sales90Max');
    const vintageMin = p.get('vintageMin');
    const vintageMax = p.get('vintageMax');
    const supplyPriceMin = p.get('supplyPriceMin');
    const supplyPriceMax = p.get('supplyPriceMax');
    const retailPriceMin = p.get('retailPriceMin');
    const retailPriceMax = p.get('retailPriceMax');
    const country = p.get('country');

    let query = supabase.from(table).select('*');

    // Text search (optional)
    if (q.trim()) {
      const safe = q.trim().toLowerCase().replace(/[%_,.()"\\]/g, '');
      query = query.or(`item_name.ilike.%${safe}%,item_no.ilike.%${safe}%`);
    }

    // Supply price range
    if (supplyPriceMin) query = query.gte('supply_price', Number(supplyPriceMin));
    if (supplyPriceMax) query = query.lte('supply_price', Number(supplyPriceMax));

    // Retail price range
    if (retailPriceMin) query = query.gte('retail_price', Number(retailPriceMin));
    if (retailPriceMax) query = query.lte('retail_price', Number(retailPriceMax));

    // Vintage range
    if (vintageMin) query = query.gte('vintage', vintageMin);
    if (vintageMax) query = query.lte('vintage', vintageMax);

    // 30-day sales range
    if (sales30Min) query = query.gte('sales_30days', Number(sales30Min));
    if (sales30Max) query = query.lte('sales_30days', Number(sales30Max));

    // 90-day avg sales range
    if (sales90Min) query = query.gte('avg_sales_90d', Number(sales90Min));
    if (sales90Max) query = query.lte('avg_sales_90d', Number(sales90Max));

    // Country filter (exact match from dropdown)
    if (country) {
      query = query.eq('country', country.trim());
    }

    query = query.order('supply_price', { ascending: false }).limit(500);

    const { data, error } = await query;
    if (error) throw error;

    // Stock range filter (available_stock + bonded_warehouse) - done in JS
    let results = data || [];
    if (stockMin || stockMax) {
      const lo = stockMin ? Number(stockMin) : null;
      const hi = stockMax ? Number(stockMax) : null;
      results = results.filter((r: any) => {
        const total = (r.available_stock || 0) + (r.bonded_warehouse || 0);
        if (lo !== null && total < lo) return false;
        if (hi !== null && total > hi) return false;
        return true;
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
