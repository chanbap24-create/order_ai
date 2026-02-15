import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

// GET: shipments 테이블에서 고유 담당자 목록 조회
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const table = searchParams.get('table') || 'shipments';

    // distinct가 없으므로 전체 manager를 가져와서 중복 제거
    // 대량 데이터 대비: 페이지네이션으로 전체 순회
    const allManagers = new Set<string>();
    let from = 0;
    const batchSize = 1000;

    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select('manager')
        .not('manager', 'is', null)
        .neq('manager', '')
        .range(from, from + batchSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      for (const r of data) {
        if (r.manager) allManagers.add(r.manager);
      }

      if (data.length < batchSize) break;
      from += batchSize;
    }

    // 비영업 담당자 제외
    const EXCLUDE = ['윤영란', '정진경', '편지은', '경영지원부', 'ADMIN'];
    const managers = [...allManagers]
      .filter(m => !EXCLUDE.includes(m))
      .sort();

    return NextResponse.json({ managers });
  } catch (err) {
    console.error('GET /api/sales/clients/managers error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
