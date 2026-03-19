import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

const ALLOWED_TABLES = ['payments', 'dl_payments', 'shipments', 'glass_shipments'] as const;

export async function GET(req: NextRequest) {
  const table = req.nextUrl.searchParams.get('table');
  if (!table || !ALLOWED_TABLES.includes(table as any)) {
    return NextResponse.json({ error: 'Invalid table' }, { status: 400 });
  }

  const dateCol = table.includes('payment') ? 'payment_date' : 'ship_date';

  const [countRes, minRes, maxRes] = await Promise.all([
    supabase.from(table).select('*', { count: 'exact', head: true }),
    supabase.from(table).select(dateCol).not(dateCol, 'is', null).order(dateCol, { ascending: true }).limit(1),
    supabase.from(table).select(dateCol).not(dateCol, 'is', null).order(dateCol, { ascending: false }).limit(1),
  ]);

  return NextResponse.json({
    count: countRes.count || 0,
    minDate: minRes.data?.[0]?.[dateCol] || null,
    maxDate: maxRes.data?.[0]?.[dateCol] || null,
  });
}
