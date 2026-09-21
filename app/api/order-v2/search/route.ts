import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { splitSearchWords, applyMultiWordSearch } from '@/app/lib/searchUtils';

// 와인 검색 API (수동 품목 변경용)
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || '';
  const tab = req.nextUrl.searchParams.get('tab') || 'CDV';
  const inStock = req.nextUrl.searchParams.get('in_stock') === '1'; // 재고 있는 품목만 (시음주 선택 등)
  const table = tab === 'DL' ? 'inventory_dl' : 'inventory_cdv';

  if (!q.trim()) {
    return NextResponse.json({ results: [] });
  }

  try {
    const words = splitSearchWords(q);
    let dbQuery = supabase
      .from(table)
      .select('item_no, item_name, supply_price, available_stock')
      .not('item_no', 'ilike', 'zk%'); // 백화점 매장 품번(ZK) 제외 — 발주 대상 아님
    if (inStock) dbQuery = dbQuery.gt('available_stock', 0);
    dbQuery = applyMultiWordSearch(dbQuery, words, 'item_name', ['item_no']);
    const { data, error } = await dbQuery
      .order('item_name', { ascending: true })
      .limit(20);

    if (error) throw error;
    return NextResponse.json({ results: data || [] });
  } catch (error: any) {
    return NextResponse.json({ results: [], error: error.message }, { status: 500 });
  }
}
