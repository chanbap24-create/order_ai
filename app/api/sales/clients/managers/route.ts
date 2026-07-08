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

    // sales_users 계정도 포함 (거래처 없어도 로그인 가능)
    const { data: users } = await supabase
      .from('sales_users')
      .select('manager, role')
      .neq('role', 'admin')
      .neq('is_active', false); // 숨김(비활성) 계정 제외
    const executives: string[] = [];
    for (const u of (users || [])) {
      if (u.manager) {
        allManagers.add(u.manager);
        if (u.role === 'executive') executives.push(u.manager);
      }
    }

    // 비영업·퇴사 담당자 제외(드롭다운에서 숨김 — 거래처 데이터는 보존)
    const EXCLUDE = ['정진경', '편지은', '경영지원부', 'ADMIN', 'Admin',
      // 퇴사자(계정 없음, client_details 담당자명으로만 잔존)
      '강여울', '고성원', '공민규', '공태욱', '김기덕', '하홍집',
      // 숨김 처리한 휴면계정 중 거래처 잔존으로 드롭다운에 뜨던 것
      '이진희'];
    const regular = [...allManagers]
      .filter(m => !EXCLUDE.includes(m) && !executives.includes(m))
      .sort();

    // 임원을 맨 위에 배치
    const managers = [...executives, ...regular];

    return NextResponse.json({ managers });
  } catch (err) {
    console.error('GET /api/sales/clients/managers error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
