import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';

// GET: client_details 테이블에서 고유 담당자 목록 조회
export async function GET(req: NextRequest) {
  try {
    // client_details는 ~4,500행으로 가벼움 (shipments 99,000+ 대비)
    const { data, error } = await supabase
      .from('client_details')
      .select('manager')
      .not('manager', 'is', null)
      .neq('manager', '');

    if (error) throw error;

    const allManagers = new Set<string>();
    for (const r of (data || [])) {
      if (r.manager) allManagers.add(r.manager);
    }

    // 비영업 담당자 제외
    const EXCLUDE = ['윤영란', '정진경', '편지은', '경영지원부', 'ADMIN', 'Admin'];
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
