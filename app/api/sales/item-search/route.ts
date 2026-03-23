import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { splitSearchWords, applyMultiWordSearch } from '@/app/lib/searchUtils';

// GET: 품목 검색 (자동완성)
// ?q=XXX&warehouse=CDV
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const warehouse = searchParams.get('warehouse') || 'CDV';

    if (q.trim().length < 1) {
      return NextResponse.json({ items: [] });
    }

    const table = warehouse === 'DL' ? 'glass_shipments' : 'shipments';

    // item_no 정확 매칭 우선
    const { data: exactMatch } = await supabase
      .from(table)
      .select('item_no, item_name')
      .eq('item_no', q.trim())
      .limit(1);

    if (exactMatch && exactMatch.length > 0) {
      return NextResponse.json({
        items: [{ item_no: exactMatch[0].item_no, item_name: exactMatch[0].item_name }],
      });
    }

    // item_name ILIKE 검색 - 고유 품목 추출
    const words = splitSearchWords(q);
    let nameQuery = supabase
      .from(table)
      .select('item_no, item_name');
    nameQuery = applyMultiWordSearch(nameQuery, words, 'item_name', ['item_no']);
    const { data: nameMatch } = await nameQuery
      .order('ship_date', { ascending: false })
      .limit(200);

    // 중복 제거 (item_no 기준)
    const seen = new Map<string, string>();
    for (const r of (nameMatch || [])) {
      if (r.item_no && !seen.has(r.item_no)) {
        seen.set(r.item_no, r.item_name);
      }
    }

    const items = Array.from(seen.entries())
      .map(([item_no, item_name]) => ({ item_no, item_name }))
      .slice(0, 20);

    return NextResponse.json({ items });
  } catch (err) {
    console.error('GET /api/sales/item-search error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
