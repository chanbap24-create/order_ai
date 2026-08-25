import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { hashPassword, verifyToken } from '@/app/lib/auth';
import { getEnv } from '@/app/lib/env';

// 설정 키 검증 (초기 세팅 시 환경변수로 관리)
function verifySetupKey(req: NextRequest): boolean {
  const setupKey = getEnv('SETUP_SECRET_KEY');
  if (!setupKey) return false; // 키 미설정 시 차단
  const provided = req.headers.get('x-setup-key') || req.nextUrl.searchParams.get('key');
  return provided === setupKey;
}

// admin 세션 검증
async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get('admin_auth')?.value;
  if (!token) return false;
  const payload = verifyToken(token);
  return payload?.role === 'admin';
}

// 초기 비밀번호 정책: 8자 이상 + 흔한 약한값 금지 (예: 0000/1234).
const WEAK_PASSWORDS = new Set(['00000000', '12345678', '11111111', 'password', 'qwertyui']);
function validateInitialPassword(pw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof pw !== 'string' || pw.length < 8 || pw.length > 72) {
    return { ok: false, error: '초기 비밀번호(initial_password)는 8~72자여야 합니다.' };
  }
  if (/^(\d)\1*$/.test(pw) || WEAK_PASSWORDS.has(pw.toLowerCase())) {
    return { ok: false, error: '너무 단순한 초기 비밀번호입니다. 다른 값을 사용하세요.' };
  }
  return { ok: true, value: pw };
}

// POST: 초기 사용자 생성 (admin 인증 또는 setup key 필요)
// body: { initial_password: string }  — 전 계정 공통 초기 비번(8자+). 생성 후 각자 변경 유도.
export async function POST(req: NextRequest) {
  const isAdmin = await verifyAdmin(req);
  const hasSetupKey = verifySetupKey(req);

  if (!isAdmin && !hasSetupKey) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  let body: { initial_password?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    /* body 없을 수 있음 — 아래 검증에서 거부 */
  }
  const pwCheck = validateInitialPassword(body.initial_password);
  if (!pwCheck.ok) {
    return NextResponse.json({ error: pwCheck.error }, { status: 400 });
  }

  try {
    // 이미 사용자가 있는지 확인
    const { data: existing } = await supabase
      .from('sales_users')
      .select('manager')
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({
        message: '이미 사용자가 등록되어 있습니다.',
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

    const initialHash = await hashPassword(pwCheck.value);
    const users = managers.map(m => ({
      manager: m,
      password_hash: initialHash,
      role: 'user',
    }));

    // ADMIN 계정 추가
    users.push({
      manager: 'ADMIN',
      password_hash: initialHash,
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
      { error: '사용자 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// GET: 사용자 목록 (admin 인증 필요)
export async function GET(req: NextRequest) {
  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  try {
    const { data: users } = await supabase
      .from('sales_users')
      .select('manager, role, created_at, updated_at')
      .order('role', { ascending: true })
      .order('manager', { ascending: true });

    return NextResponse.json({ users: users || [] });
  } catch {
    return NextResponse.json({ error: '조회 실패' }, { status: 500 });
  }
}
