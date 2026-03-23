import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

// 거래처 입고내역 API
export async function GET(req: NextRequest) {
  const clientCode = req.nextUrl.searchParams.get('client_code') || '';
  const tab = req.nextUrl.searchParams.get('tab') || 'CDV';

  if (!clientCode.trim()) {
    return NextResponse.json({ items: [] });
  }

  try {
    const shipTable = tab === 'DL' ? 'glass_shipments' : 'shipments';
    // 글라스: unit_price = 거래처 실거래 단가, 와인: selling_price = 거래처 실거래 단가
    const priceCol = tab === 'DL' ? 'unit_price' : 'selling_price';

    // 출고 이력 조회
    const { data, error } = await supabase
      .from(shipTable)
      .select(`item_no, item_name, ship_date, ${priceCol}, quantity`)
      .eq('client_code', clientCode)
      .order('ship_date', { ascending: false });
    if (error) throw error;

    // 품목별 그룹핑: 최근 출고의 거래 단가 사용
    const map = new Map<string, {
      item_no: string;
      item_name: string;
      supply_price: number;
      buy_count: number;
      last_ship_date: string;
    }>();

    for (const row of (data || [])) {
      const price = (row as any)[priceCol] || 0;
      const existing = map.get(row.item_no);
      if (!existing) {
        map.set(row.item_no, {
          item_no: row.item_no,
          item_name: row.item_name,
          supply_price: price,
          buy_count: 1,
          last_ship_date: row.ship_date || '',
        });
      } else {
        existing.buy_count += 1;
      }
    }

    const items = [...map.values()]
      .sort((a, b) => b.last_ship_date.localeCompare(a.last_ship_date))
      .slice(0, 200);

    return NextResponse.json({ items });
  } catch (error: any) {
    return NextResponse.json({ items: [], error: error.message }, { status: 500 });
  }
}
