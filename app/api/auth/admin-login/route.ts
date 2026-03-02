import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { verifyPassword, isLegacyHash, verifyLegacyPassword } from '@/app/lib/auth';
import { createHmac } from 'crypto';

const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
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

    // ADMIN 계정 조회
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
      return NextResponse.json({ error: '비밀번호가 틀렸습니다.' }, { status: 401 });
    }

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
