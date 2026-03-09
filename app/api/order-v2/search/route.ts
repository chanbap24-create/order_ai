import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

// 와인 검색 API (수동 품목 변경용)
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || '';
  const tab = req.nextUrl.searchParams.get('tab') || 'CDV';
  const table = tab === 'DL' ? 'inventory_dl' : 'inventory_cdv';

  if (!q.trim()) {
    return NextResponse.json({ results: [] });
  }

  try {
    const safe = q.trim().replace(/[%_,.()"\\]/g, '');
    const { data, error } = await supabase
      .from(table)
      .select('item_no, item_name, supply_price, available_stock')
      .or(`item_name.ilike.%${safe}%,item_no.ilike.%${safe}%`)
      .order('item_name', { ascending: true })
      .limit(20);

    if (error) throw error;
    return NextResponse.json({ results: data || [] });
  } catch (error: any) {
    return NextResponse.json({ results: [], error: error.message }, { status: 500 });
  }
}
