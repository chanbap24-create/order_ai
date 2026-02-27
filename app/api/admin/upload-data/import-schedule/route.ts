import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/db";

interface ImportScheduleItem {
  item_code: string;
  item_name_kr: string;
  item_name_en: string;
  brand_code: string;
  vintage: string;
  total_btls: number;
  bl_number: string;
  arrival_date: string;
}

// POST: 전체 교체 (DELETE → INSERT)
export async function POST(request: NextRequest) {
  try {
    const { items } = (await request.json()) as { items: ImportScheduleItem[] };
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: '데이터가 없습니다.' }, { status: 400 });
    }

    // 기존 전체 삭제
    await supabase.from('import_schedule').delete().gte('id', 0);

    // bulk insert (1000건씩)
    const BATCH = 1000;
    let inserted = 0;
    for (let i = 0; i < items.length; i += BATCH) {
      const batch = items.slice(i, i + BATCH).map(item => ({
        item_code: item.item_code,
        item_name_kr: item.item_name_kr,
        item_name_en: item.item_name_en,
        brand_code: item.brand_code,
        vintage: item.vintage,
        total_btls: item.total_btls,
        bl_number: item.bl_number,
        arrival_date: item.arrival_date,
      }));
      const { error } = await supabase.from('import_schedule').insert(batch);
      if (error) throw error;
      inserted += batch.length;
    }

    return NextResponse.json({ success: true, inserted });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// GET: 달력 표시용 조회
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');

    let query = supabase
      .from('import_schedule')
      .select('*')
      .order('arrival_date', { ascending: true });

    if (startDate) query = query.gte('arrival_date', startDate);
    if (endDate) query = query.lte('arrival_date', endDate);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, items: data || [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
