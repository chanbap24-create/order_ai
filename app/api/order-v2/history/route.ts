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
    const invTable = tab === 'DL' ? 'inventory_dl' : 'inventory_cdv';

    // 출고 이력 조회
    const { data, error } = await supabase
      .from(shipTable)
      .select('item_no, item_name, ship_date, selling_price, quantity')
      .eq('client_code', clientCode)
      .order('ship_date', { ascending: false });
    if (error) throw error;

    // 품목별 그룹핑
    const map = new Map<string, {
      item_no: string;
      item_name: string;
      supply_price: number;
      buy_count: number;
      last_ship_date: string;
      last_selling_price: number;
    }>();

    for (const row of (data || [])) {
      const existing = map.get(row.item_no);
      if (!existing) {
        map.set(row.item_no, {
          item_no: row.item_no,
          item_name: row.item_name,
          supply_price: 0,
          buy_count: 1,
          last_ship_date: row.ship_date || '',
          last_selling_price: row.selling_price || 0,
        });
      } else {
        existing.buy_count += 1;
      }
    }

    // inventory에서 실제 공급가 조회
    const itemNos = [...map.keys()];
    if (itemNos.length > 0) {
      // 배치 조회 (500개씩)
      for (let i = 0; i < itemNos.length; i += 500) {
        const batch = itemNos.slice(i, i + 500);
        const { data: invData } = await supabase
          .from(invTable)
          .select('item_no, supply_price')
          .in('item_no', batch);
        for (const inv of (invData || [])) {
          const item = map.get(inv.item_no);
          if (item) item.supply_price = inv.supply_price || 0;
        }
      }
    }

    const items = [...map.values()]
      .sort((a, b) => b.last_ship_date.localeCompare(a.last_ship_date))
      .slice(0, 200)
      .map(({ last_selling_price, ...rest }) => rest);

    return NextResponse.json({ items });
  } catch (error: any) {
    return NextResponse.json({ items: [], error: error.message }, { status: 500 });
  }
}
