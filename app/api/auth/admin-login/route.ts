import { NextResponse } from 'next/server';
import { isProd } from '@/app/lib/env';
import { supabase } from '@/app/lib/db';
import { verifyPassword, isLegacyHash, verifyLegacyPassword } from '@/app/lib/auth';
import { rateLimit } from '@/app/lib/rateLimit';
import { verifyToken as verifyTotp, verifyBackupCode } from '@/app/lib/totp';
import { createHmac } from 'crypto';
import { getSessionSecret } from '@/app/lib/sessionSecret';

const SECRET = getSessionSecret();
const ADMIN_COOKIE_NAME = 'admin_auth';
const PENDING_COOKIE = 'admin_mfa_pending';

function signPayload(payload: object): string {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json).toString('base64url');
  const sig = createHmac('sha256', SECRET).update(b64).digest('base64url');
  return `${b64}.${sig}`;
}

/**
 * Admin 로그인 POST:
 *  1단계: { password } → password 검증 → totp_enabled 이면 pending token 발급
 *  2단계: { password, totp } 또는 { password, backup_code } → TOTP 검증 → admin_auth
 *
 * totp_enabled 가 false 면 password 만으로 admin_auth 발급 (첫 setup 유도용).
 */
export async function POST(req: Request) {
  try {
    const { password, totp, backup_code } = await req.json();
    if (!password) {
      return NextResponse.json({ error: '비밀번호를 입력해주세요.' }, { status: 400 });
    }
    if (typeof password !== 'string' || password.length > 72) {
      return NextResponse.json({ error: '비밀번호 형식이 올바르지 않습니다.' }, { status: 400 });
    }

    // IP 단위 rate limit (Admin DoS 방어)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const { allowed, resetIn } = rateLimit(`admin-login:${ip}`, 5, 60_000);
    if (!allowed) {
      return NextResponse.json(
        { error: `로그인 시도가 너무 많습니다. ${Math.ceil(resetIn / 1000)}초 후 다시 시도해주세요.` },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(resetIn / 1000)) } },
      );
    }

    const { data: user } = await supabase
      .from('sales_users')
      .select('manager, password_hash, role, totp_secret, totp_enabled, totp_backup_codes')
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

    await supabase.from('sales_users').update({ failed_attempts: 0, locked_until: null }).eq('role', 'admin');

    // MFA 미설정 상태: password 만으로 admin_auth 발급 + 프론트에서 setup 유도.
    if (!user.totp_enabled || !user.totp_secret) {
      const token = signPayload({ role: 'admin', ts: Date.now() });
      const response = NextResponse.json({
        success: true,
        mfa_required: false,
        mfa_setup_needed: true, // 프론트가 /api/auth/admin-mfa/setup 호출 유도
      });
      response.cookies.set(ADMIN_COOKIE_NAME, token, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24,
      });
      return response;
    }

    // MFA 설정됨: TOTP 코드 또는 backup code 확인
    if (!totp && !backup_code) {
      // 1단계 완료 — pending token (짧게, 5분) 발급 + 프론트에 MFA 입력 요청
      const pendingToken = signPayload({
        stage: 'mfa_pending', role: 'admin', ts: Date.now(),
      });
      const response = NextResponse.json({ success: false, mfa_required: true });
      response.cookies.set(PENDING_COOKIE, pendingToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 5, // 5분
      });
      return response;
    }

    // 2단계: TOTP 또는 backup code 검증
    let mfaValid = false;
    let updatedBackupCodes: string[] | null = null;
    if (totp) {
      mfaValid = verifyTotp(user.totp_secret, String(totp));
    } else if (backup_code) {
      const storedHashes = (user.totp_backup_codes || []) as string[];
      const { valid: bcValid, matchedHash } = verifyBackupCode(String(backup_code), storedHashes);
      mfaValid = bcValid;
      if (bcValid && matchedHash) {
        // 1회용 → 사용한 해시 제거
        updatedBackupCodes = storedHashes.filter((h) => h !== matchedHash);
      }
    }

    if (!mfaValid) {
      return NextResponse.json({ error: 'MFA 코드가 올바르지 않습니다.', mfa_required: true }, { status: 401 });
    }

    if (updatedBackupCodes !== null) {
      await supabase.from('sales_users')
        .update({ totp_backup_codes: updatedBackupCodes })
        .eq('role', 'admin');
    }

    const token = signPayload({ role: 'admin', ts: Date.now() });
    const response = NextResponse.json({ success: true, mfa_required: false });
    response.cookies.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24,
    });
    // pending 쿠키 정리
    response.cookies.set(PENDING_COOKIE, '', {
      httpOnly: true, secure: isProd,
      sameSite: 'lax', path: '/', maxAge: 0,
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
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
