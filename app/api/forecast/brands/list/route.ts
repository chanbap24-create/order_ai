import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

export async function GET() {
  try {
    const { data } = await supabase.from('wines')
      .select('supplier_kr, country')
      .not('item_code', 'like', 'D%')
      .not('supplier_kr', 'is', null);

    const { data: allWines } = await supabase.from('wines')
      .select('brand, supplier_kr, country')
      .not('item_code', 'like', 'D%');

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
