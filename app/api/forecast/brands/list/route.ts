import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { fetchAllRows } from '@/app/lib/fetchAll';

export async function GET() {
  try {
    // wines 2,000+행 — 1000행 캡 페이지네이션. (첫 쿼리는 미사용이라 제거)
    const allWines = await fetchAllRows<{ brand: string | null; supplier_kr: string | null; country: string | null }>((f, t) =>
      supabase.from('wines')
        .select('brand, supplier_kr, country')
        .not('item_code', 'like', 'D%').order('brand').range(f, t));

    const agg: Record<string, { supplier: string; abbr: string; country: string; count: number }> = {};
    for (const w of (allWines || [])) {
      if (!w.supplier_kr || !w.brand) continue;
      if (!agg[w.brand]) agg[w.brand] = { supplier: w.supplier_kr, abbr: w.brand, country: w.country || '', count: 0 };
      agg[w.brand].count++;
    }

    const brands = Object.values(agg)
      .map(d => ({ name: d.supplier, abbr: d.abbr, country: d.country, count: d.count }))
      .sort((a, b) => a.abbr.localeCompare(b.abbr));

    return NextResponse.json({ brands });
  } catch (err) {
    return NextResponse.json({ brands: [] }, { status: 500 });
  }
}
