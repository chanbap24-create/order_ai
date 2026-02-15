import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { hashPassword } from '@/app/lib/auth';

// POST: 초기 사용자 생성 (managers 목록에서 자동 생성)
export async function POST() {
  try {
    // 이미 사용자가 있는지 확인
    const { data: existing } = await supabase
      .from('sales_users')
      .select('manager')
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({
        message: '이미 사용자가 등록되어 있습니다. 추가 등록은 /api/auth/setup PUT을 사용하세요.',
        existing_count: existing.length,
      });
    }

    // shipments에서 담당자 목록 추출
    const allManagers = new Set<string>();
    let from = 0;
    const batchSize = 1000;
    while (true) {
      const { data } = await supabase
        .from('shipments')
        .select('manager')
        .not('manager', 'is', null)
        .neq('manager', '')
        .range(from, from + batchSize - 1);
      if (!data || data.length === 0) break;
      for (const r of data) {
        if (r.manager) allManagers.add(r.manager);
      }
      if (data.length < batchSize) break;
      from += batchSize;
    }

    // 비영업 담당자 제외
    const EXCLUDE = ['윤영란', '정진경', '편지은', '경영지원부'];
    const managers = [...allManagers].filter(m => !EXCLUDE.includes(m)).sort();

    const defaultHash = hashPassword('0000');
    const users = managers.map(m => ({
      manager: m,
      password_hash: defaultHash,
      role: 'user',
    }));

    // ADMIN 계정 추가
    users.push({
      manager: 'ADMIN',
      password_hash: defaultHash,
      role: 'admin',
    });

    // 일괄 삽입
    const { error } = await supabase
      .from('sales_users')
      .upsert(users, { onConflict: 'manager' });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      created: users.length,
      managers: users.map(u => ({ manager: u.manager, role: u.role })),
    });
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json(
      { error: '사용자 생성 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// GET: 사용자 목록 (admin 전용)
export async function GET() {
  try {
    const { data: users } = await supabase
      .from('sales_users')
      .select('manager, role, created_at, updated_at')
      .order('role', { ascending: true })
      .order('manager', { ascending: true });

    return NextResponse.json({ users: users || [] });
  } catch (error) {
    return NextResponse.json({ error: '조회 실패' }, { status: 500 });
  }
}
