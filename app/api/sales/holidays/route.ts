import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { ensureHolidayCache } from '@/app/lib/holidays';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

    // 캐시 보장 (API → DB 동기화)
    await ensureHolidayCache(year);

    const { data, error } = await supabase
      .from('holidays')
      .select('ymd, name')
      .eq('year', year)
      .order('ymd');

    if (error) throw error;

    // { "2026-01-01": "신정", "2026-02-16": "설날", ... }
    const holidays: Record<string, string> = {};
    for (const row of data || []) {
      holidays[row.ymd] = row.name;
    }

    return NextResponse.json({ holidays });
  } catch (e: any) {
    console.error('[holidays API]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
