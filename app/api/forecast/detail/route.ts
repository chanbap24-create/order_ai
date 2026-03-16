import { supabase } from '@/app/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { itemCodes, startDate, endDate, manager } = await request.json();
    if (!itemCodes?.length) return NextResponse.json({ shipments: [] });

    const allRows: typeof data = [];
    let from = 0;
    while (true) {
      let query = supabase
        .from('shipments')
        .select('ship_date, quantity, unit_price, selling_price, item_no, item_name, client_name, manager')
        .in('item_no', itemCodes)
        .gt('quantity', 0)
        .order('ship_date', { ascending: false })
        .range(from, from + 999);

      if (startDate) query = query.gte('ship_date', startDate);
      if (endDate) query = query.lte('ship_date', endDate);
      if (manager && manager !== '__all__') query = query.eq('manager', manager);

      const { data: page, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!page || page.length === 0) break;
      allRows.push(...page);
      if (page.length < 1000) break;
      from += 1000;
    }
    const data = allRows;

    const shipments = (data || []).map(s => ({
      date: s.ship_date,
      client: s.client_name,
      qty: s.quantity,
      price: s.ship_date >= '2025-08-01'
        ? (s.selling_price || s.unit_price || 0)
        : (s.selling_price && s.quantity > 0 ? Math.round(s.selling_price / s.quantity) : s.unit_price || 0),
      manager: s.manager,
      item_no: s.item_no,
    }));

    return NextResponse.json({ shipments });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
