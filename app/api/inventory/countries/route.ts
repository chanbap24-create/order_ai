import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

export async function GET(req: NextRequest) {
  const tab = req.nextUrl.searchParams.get('tab') || 'CDV';
  const table = tab === 'DL' ? 'inventory_dl' : 'inventory_cdv';

  const { data, error } = await supabase.from(table).select('country');
  if (error) return NextResponse.json({ countries: [] });

  const set = new Set<string>();
  for (const r of data || []) {
    if (r.country) set.add(r.country);
  }
  const countries = [...set].sort((a, b) => a.localeCompare(b, 'ko'));
  return NextResponse.json({ countries });
}
