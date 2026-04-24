/**
 * Admin MFA 최초 설정.
 *
 *  POST (GET session 필요): 새 secret 생성 + QR 반환.
 *       → 프론트에서 QR 스캔 후 code 입력 → verify 호출
 *
 *  POST body { code }: 사용자가 QR 스캔 후 입력한 첫 6자리 코드 검증.
 *       성공 시 totp_enabled=true + totp_secret 저장 + 백업 코드 10개 생성/반환.
 *
 * 인증: middleware 가 /api/admin/* 보호하지만 /api/auth/* 는 공개 경로.
 *       여기서는 admin_auth 쿠키를 직접 검증해서 로그인된 admin 만 허용.
 */

import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import { createHmac } from 'crypto';
import {
  generateSecret, buildOtpAuthUrl, generateQrDataUrl,
  verifyToken as verifyTotp, generateBackupCodes,
} from '@/app/lib/totp';

const SECRET = process.env.AUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ADMIN_COOKIE_NAME = 'admin_auth';

async function requireAdmin(): Promise<boolean> {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return false;
  const dotIdx = token.indexOf('.');
  if (dotIdx < 0) return false;
  const b64 = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  const expected = createHmac('sha256', SECRET).update(b64).digest('base64url');
  if (sig !== expected) return false;
  try {
    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString());
    if (payload.role !== 'admin') return false;
    if (payload.ts && Date.now() - payload.ts > 24 * 60 * 60 * 1000) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * 1단계: 새 secret + QR 반환.
 * 이미 totp_enabled=true 면 거부 (재설정은 /disable 호출 후).
 */
export async function GET() {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: '관리자 인증이 필요합니다.' }, { status: 401 });
  }

  const { data: user } = await supabase
    .from('sales_users')
    .select('manager, totp_enabled')
    .eq('role', 'admin')
    .maybeSingle();

  if (!user) return NextResponse.json({ error: '관리자 계정이 없습니다.' }, { status: 404 });
  if (user.totp_enabled) {
    return NextResponse.json({ error: 'MFA가 이미 설정되어 있습니다. 먼저 비활성화 후 재설정하세요.' }, { status: 400 });
  }

  const secret = generateSecret();
  const accountName = user.manager || 'admin';
  const otpauthUrl = buildOtpAuthUrl(accountName, secret);
  const qrDataUrl = await generateQrDataUrl(otpauthUrl);

  // 아직 저장 안 함. POST 에서 사용자 입력 code 로 검증 후 저장.
  // secret 을 프론트에 전달해 POST 때 함께 받음 (서버 상태 안 만듦).
  return NextResponse.json({
    secret,
    qr_data_url: qrDataUrl,
    otpauth_url: otpauthUrl,
  });
}

/**
 * 2단계: 사용자가 QR 스캔 후 입력한 코드 검증 + secret 저장.
 * body: { secret, code }
 */
export async function POST(req: Request) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: '관리자 인증이 필요합니다.' }, { status: 401 });
  }

  const { secret, code } = await req.json();
  if (typeof secret !== 'string' || typeof code !== 'string') {
    return NextResponse.json({ error: 'secret, code 필수' }, { status: 400 });
  }

  if (!verifyTotp(secret, code)) {
    return NextResponse.json({ error: '코드가 올바르지 않습니다. 시계 동기화를 확인하세요.' }, { status: 400 });
  }

  // 백업 코드 10개 생성
  const { plain: backupPlain, hashed: backupHashed } = generateBackupCodes(10);

  const { error } = await supabase
    .from('sales_users')
    .update({
      totp_secret: secret,
      totp_enabled: true,
      totp_backup_codes: backupHashed,
    })
    .eq('role', 'admin');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    backup_codes: backupPlain,
    // 한 번만 표시. 사용자에게 안전한 곳에 저장하라고 안내.
  });
}

/**
 * MFA 비활성화 (재설정 시나리오용).
 * body: { code } — 현재 TOTP 코드 or 백업 코드로 확인 필요.
 * 보안상 password 요구는 이미 admin_auth 로 검증됨.
 */
export async function DELETE(req: Request) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: '관리자 인증이 필요합니다.' }, { status: 401 });
  }

  const { code } = await req.json();
  if (typeof code !== 'string') {
    return NextResponse.json({ error: 'code 필수' }, { status: 400 });
  }

  const { data: user } = await supabase
    .from('sales_users')
    .select('totp_secret, totp_enabled, totp_backup_codes')
    .eq('role', 'admin')
    .maybeSingle();

  if (!user?.totp_enabled || !user.totp_secret) {
    return NextResponse.json({ error: 'MFA가 설정되어 있지 않습니다.' }, { status: 400 });
  }

  const { hashBackupCode } = await import('@/app/lib/totp');
  const storedHashes = (user.totp_backup_codes || []) as string[];
  const mfaValid = verifyTotp(user.totp_secret, code)
    || storedHashes.includes(hashBackupCode(code));

  if (!mfaValid) {
    return NextResponse.json({ error: '코드가 올바르지 않습니다.' }, { status: 401 });
  }

  const { error } = await supabase
    .from('sales_users')
    .update({ totp_secret: null, totp_enabled: false, totp_backup_codes: null })
    .eq('role', 'admin');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
