import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

// GET: 거래처 업태(business_type) 목록 + 건수 — 발굴 모드의 업태 선택용.
export async function GET() {
  try {
    // 페이지네이션 — client_details ~4500행이라 단발 조회는 1000행 캡에 걸려 업태 집계가 ~22%만 반영됨.
    const data: Array<{ business_type?: string }> = [];
    for (let from = 0; from < 20000; from += 1000) {
      const { data: page } = await supabase
        .from('client_details')
        .select('business_type')
        .not('business_type', 'is', null)
        .range(from, from + 999);
      if (!page || page.length === 0) break;
      data.push(...(page as Array<{ business_type?: string }>));
      if (page.length < 1000) break;
    }
    const counts = new Map<string, number>();
    for (const r of data) {
      const b = (r.business_type || '').trim();
      if (b) counts.set(b, (counts.get(b) || 0) + 1);
    }
    const segments = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
    return NextResponse.json({ segments });
  } catch (error) {
    console.error('Recommend segments error:', error);
    return NextResponse.json({ segments: [] }, { status: 200 });
  }
}
