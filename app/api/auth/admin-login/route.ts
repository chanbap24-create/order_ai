import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { verifyPassword, isLegacyHash, verifyLegacyPassword } from '@/app/lib/auth';
import { rateLimit } from '@/app/lib/rateLimit';
import { createHmac } from 'crypto';

const SECRET = process.env.AUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ADMIN_COOKIE_NAME = 'admin_auth';

function signPayload(payload: object): string {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json).toString('base64url');
  const sig = createHmac('sha256', SECRET).update(b64).digest('base64url');
  return `${b64}.${sig}`;
}

export async function POST(req: Request) {
  try {
    const { password } = await req.json();
    if (!password) {
      return NextResponse.json({ error: '비밀번호를 입력해주세요.' }, { status: 400 });
    }
    // bcrypt DoS 방지: 72바이트 제한
    if (typeof password !== 'string' || password.length > 72) {
      return NextResponse.json({ error: '비밀번호 형식이 올바르지 않습니다.' }, { status: 400 });
    }

    // Admin DoS 방어: 계정 단위 잠금 대신 IP 단위 rate limit (분당 5회)
    // 이전 로직은 5회 실패 시 admin 계정 자체를 5분 잠금 → 공격자가 일부러
    // 틀린 비번으로 전체 admin 접근 차단(DoS) 가능. IP 단위로 바꿔 실제
    // 공격자만 차단되도록 수정.
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const { allowed, resetIn } = rateLimit(`admin-login:${ip}`, 5, 60_000);
    if (!allowed) {
      return NextResponse.json(
        { error: `로그인 시도가 너무 많습니다. ${Math.ceil(resetIn / 1000)}초 후 다시 시도해주세요.` },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(resetIn / 1000)) } },
      );
    }

    // ADMIN 계정 조회 (잠금 컬럼 제거)
    const { data: user } = await supabase
      .from('sales_users')
      .select('manager, password_hash, role')
      .eq('role', 'admin')
      .maybeSingle();

    if (!user) {
      return NextResponse.json({ error: '관리자 계정이 없습니다.' }, { status: 401 });
    }

    let valid = false;
    if (isLegacyHash(user.password_hash)) {
      valid = verifyLegacyPassword(password, user.password_hash);
    } else {
      valid = await verifyPassword(password, user.password_hash);
    }

    if (!valid) {
      // 계정 단위 카운터 제거 — IP 단위 rate limit 이 실패 횟수 통제.
      // bcrypt 자체의 ~100ms 지연 + rate limit 5회/분 = 분당 최대 5회 시도.
      return NextResponse.json({ error: '비밀번호가 틀렸습니다.' }, { status: 401 });
    }

    // 로그인 성공 → 남아있을지 모를 예전 failed_attempts/locked_until 정리 (best-effort)
    await supabase.from('sales_users').update({ failed_attempts: 0, locked_until: null }).eq('role', 'admin');

    const token = signPayload({ role: 'admin', ts: Date.now() });

    const response = NextResponse.json({ success: true });
    response.cookies.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 1일 (admin은 짧게)
    });

    return response;
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json({ error: '로그인 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

// GET: 세션 확인
export async function GET() {
  // middleware에서 이미 검증하므로 여기까지 왔으면 인증됨
  // 하지만 이 라우트는 /api/auth/ 하위라 미들웨어 대상 아님
  // cookies()를 직접 읽어 확인
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  // 간단 검증 (미들웨어와 동일 로직)
  const dotIdx = token.indexOf('.');
  if (dotIdx < 0) return NextResponse.json({ authenticated: false }, { status: 401 });

  const b64 = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  const expected = createHmac('sha256', SECRET).update(b64).digest('base64url');
  if (sig !== expected) return NextResponse.json({ authenticated: false }, { status: 401 });

  try {
    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString());
    if (payload.role !== 'admin') return NextResponse.json({ authenticated: false }, { status: 401 });
    const MAX_AGE_MS = 24 * 60 * 60 * 1000;
    if (payload.ts && Date.now() - payload.ts > MAX_AGE_MS) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    return NextResponse.json({ authenticated: true });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}

// DELETE: 로그아웃
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
