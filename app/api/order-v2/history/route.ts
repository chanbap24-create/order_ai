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
      // 글라스: glass_shipments에서 직접 집계
      const { data, error } = await supabase
        .from('glass_shipments')
        .select('item_no, item_name, ship_date, unit_price, quantity')
        .eq('client_code', clientCode)
        .order('ship_date', { ascending: false });
      if (error) throw error;

      const map = new Map<string, {
        item_no: string;
        item_name: string;
        supply_price: number;
        buy_count: number;
        last_ship_date: string;
      }>();

      for (const row of (data || [])) {
        const existing = map.get(row.item_no);
        if (!existing) {
          map.set(row.item_no, {
            item_no: row.item_no,
            item_name: row.item_name,
            supply_price: row.unit_price || 0,
            buy_count: 1,
            last_ship_date: row.ship_date || '',
          });
        } else {
          existing.buy_count += 1;
        }
      }

      const items = [...map.values()].sort((a, b) =>
        b.last_ship_date.localeCompare(a.last_ship_date)
      );

      return NextResponse.json({ items: items.slice(0, 200) });
    } else {
      // 와인: shipments 테이블에서 직접 집계
      const { data, error } = await supabase
        .from('shipments')
        .select('item_no, item_name, ship_date, unit_price, quantity')
        .eq('client_code', clientCode)
        .order('ship_date', { ascending: false });
      if (error) throw error;

      // 품목별 그룹핑: 최근 출고일, 횟수, 최근 단가
      const map = new Map<string, {
        item_no: string;
        item_name: string;
        supply_price: number;
        buy_count: number;
        last_ship_date: string;
      }>();

      for (const row of (data || [])) {
        const existing = map.get(row.item_no);
        if (!existing) {
          map.set(row.item_no, {
            item_no: row.item_no,
            item_name: row.item_name,
            supply_price: row.unit_price || 0,
            buy_count: 1,
            last_ship_date: row.ship_date || '',
          });
        } else {
          existing.buy_count += 1;
          // 최근 출고일의 단가 유지 (이미 ship_date 내림차순)
        }
      }

      // 최근 출고 순으로 정렬
      const items = [...map.values()].sort((a, b) =>
        b.last_ship_date.localeCompare(a.last_ship_date)
      );

      return NextResponse.json({ items: items.slice(0, 200) });
    }
  } catch (error: any) {
    return NextResponse.json({ items: [], error: error.message }, { status: 500 });
  }
}
