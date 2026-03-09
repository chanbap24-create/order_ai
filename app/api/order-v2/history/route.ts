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
    if (tab === 'DL') {
      // 글라스: glass_client_item_stats
      const { data, error } = await supabase
        .from('glass_client_item_stats')
        .select('item_no, item_name, supply_price, updated_at')
        .eq('client_code', clientCode)
        .order('updated_at', { ascending: false })
        .limit(200);
      if (error) throw error;

      return NextResponse.json({
        items: (data || []).map(d => ({
          item_no: d.item_no,
          item_name: d.item_name,
          supply_price: d.supply_price || 0,
          buy_count: 0,
          last_ship_date: d.updated_at || '',
        })),
      });
    } else {
      // 와인: client_item_stats
      const { data, error } = await supabase
        .from('client_item_stats')
        .select('item_no, item_name, supply_price, buy_count, last_ship_date, updated_at')
        .eq('client_code', clientCode)
        .order('updated_at', { ascending: false })
        .limit(200);
      if (error) throw error;

      return NextResponse.json({
        items: (data || []).map(d => ({
          item_no: d.item_no,
          item_name: d.item_name,
          supply_price: d.supply_price || 0,
          buy_count: d.buy_count || 0,
          last_ship_date: d.last_ship_date || d.updated_at || '',
        })),
      });
    }
  } catch (error: any) {
    return NextResponse.json({ items: [], error: error.message }, { status: 500 });
  }
}
