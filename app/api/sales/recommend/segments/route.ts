import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

// GET: 거래처 업태(business_type) 목록 + 건수 — 발굴 모드의 업태 선택용.
export async function GET() {
  try {
    const { data } = await supabase
      .from('client_details')
      .select('business_type')
      .not('business_type', 'is', null);
    const counts = new Map<string, number>();
    for (const r of (data || []) as Array<{ business_type?: string }>) {
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
