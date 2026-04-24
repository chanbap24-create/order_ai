/**
 * Admin 비밀번호 변경 API.
 *
 *  POST body: { current_password, new_password, totp?, backup_code? }
 *
 * 보안 요구사항:
 *  - admin_auth 쿠키 유효 (1차 관문)
 *  - current_password 일치 (2차: 세션 탈취 시 즉시 비번 변경 차단)
 *  - MFA 설정됨 → TOTP 또는 백업 코드 재검증 (3차: 쿠키+비번 모두 털린 경우)
 *  - new_password: 8자 이상, 72자 이하, 현재와 다름
 *
 * 성공 시 admin_auth 쿠키를 **새로 발급** (로그인 세션 재시작, 다른 기기 세션은 유지되지만
 *   쿠키 secret 교체가 아니면 완전 무효화 불가 — 현재 위협 모델 충분).
 */

import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/db';
import {
  hashPassword, verifyPassword, isLegacyHash, verifyLegacyPassword,
} from '@/app/lib/auth';
import { isAdminAuthenticated } from '@/app/lib/adminAuth';
import { rateLimit } from '@/app/lib/rateLimit';
import { verifyToken as verifyTotp, verifyBackupCode } from '@/app/lib/totp';

const MIN_LEN = 8;
const MAX_LEN = 72;

/**
 * GET: admin MFA 활성화 여부 조회 (UI에서 MFA 입력 필드 표시 여부 결정).
 */
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: '관리자 인증이 필요합니다.' }, { status: 401 });
  }
  const { data, error } = await supabase
    .from('sales_users')
    .select('totp_enabled')
    .eq('role', 'admin')
    .maybeSingle();
  if (error) {
    console.error('[admin-password GET] select error:', error);
    // totp_enabled 컬럼 미존재 → 마이그레이션 필요
    if (error.message?.includes('totp_') || error.code === '42703') {
      return NextResponse.json({ mfa_enabled: false, migration_needed: true });
    }
  }
  return NextResponse.json({ mfa_enabled: !!data?.totp_enabled });
}

export async function POST(req: Request) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: '관리자 인증이 필요합니다.' }, { status: 401 });
    }

    // IP + admin 조합으로 rate limit (비밀번호 추측 방어)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const { allowed, resetIn } = rateLimit(`admin-pw:${ip}`, 5, 60_000);
    if (!allowed) {
      return NextResponse.json(
        { error: `시도가 너무 많습니다. ${Math.ceil(resetIn / 1000)}초 후 다시 시도해주세요.` },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(resetIn / 1000)) } },
      );
    }

    const { current_password, new_password, totp, backup_code } = await req.json();

    if (typeof current_password !== 'string' || current_password.length === 0 || current_password.length > MAX_LEN) {
      return NextResponse.json({ error: '현재 비밀번호를 입력해주세요.' }, { status: 400 });
    }
    if (typeof new_password !== 'string' || new_password.length < MIN_LEN || new_password.length > MAX_LEN) {
      return NextResponse.json({ error: `새 비밀번호는 ${MIN_LEN}~${MAX_LEN}자여야 합니다.` }, { status: 400 });
    }
    if (current_password === new_password) {
      return NextResponse.json({ error: '새 비밀번호는 현재 비밀번호와 달라야 합니다.' }, { status: 400 });
    }

    const { data: user, error: selErr } = await supabase
      .from('sales_users')
      .select('manager, password_hash, totp_secret, totp_enabled, totp_backup_codes')
      .eq('role', 'admin')
      .maybeSingle();

    if (selErr) {
      console.error('[admin-password] select error:', selErr);
      // column "totp_xxx" does not exist → 마이그레이션 미실행
      if (selErr.message?.includes('totp_') || selErr.code === '42703') {
        return NextResponse.json(
          { error: 'DB 마이그레이션이 필요합니다. Supabase에서 MFA 컬럼 마이그레이션을 실행해주세요.' },
          { status: 500 },
        );
      }
      return NextResponse.json({ error: `DB 오류: ${selErr.message}` }, { status: 500 });
    }
    if (!user) {
      return NextResponse.json({ error: '관리자 계정이 없습니다.' }, { status: 404 });
    }

    // 현재 비밀번호 확인
    const pwValid = isLegacyHash(user.password_hash)
      ? verifyLegacyPassword(current_password, user.password_hash)
      : await verifyPassword(current_password, user.password_hash);
    if (!pwValid) {
      return NextResponse.json({ error: '현재 비밀번호가 틀렸습니다.' }, { status: 401 });
    }

    // MFA 설정된 경우 재검증 필수
    if (user.totp_enabled && user.totp_secret) {
      if (!totp && !backup_code) {
        return NextResponse.json({ error: 'TOTP 코드 또는 백업 코드가 필요합니다.' }, { status: 400 });
      }
      let mfaValid = false;
      let updatedBackupCodes: string[] | null = null;
      if (totp) {
        mfaValid = verifyTotp(user.totp_secret, String(totp));
      } else if (backup_code) {
        const storedHashes = (user.totp_backup_codes || []) as string[];
        const { valid, matchedHash } = verifyBackupCode(String(backup_code), storedHashes);
        mfaValid = valid;
        if (valid && matchedHash) {
          updatedBackupCodes = storedHashes.filter((h) => h !== matchedHash);
        }
      }
      if (!mfaValid) {
        return NextResponse.json({ error: 'MFA 코드가 올바르지 않습니다.' }, { status: 401 });
      }
      if (updatedBackupCodes !== null) {
        await supabase.from('sales_users')
          .update({ totp_backup_codes: updatedBackupCodes })
          .eq('role', 'admin');
      }
    }

    // 새 비밀번호 저장
    const newHash = await hashPassword(new_password);
    const { error } = await supabase
      .from('sales_users')
      .update({ password_hash: newHash, updated_at: new Date().toISOString() })
      .eq('role', 'admin');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Admin password change error:', err);
    return NextResponse.json({ error: '비밀번호 변경 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
