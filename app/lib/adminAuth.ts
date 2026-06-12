/**
 * Admin 인증 쿠키(`admin_auth`) HMAC 검증 공용 헬퍼.
 *
 * 사용처:
 *  - /api/auth/admin-mfa/setup (GET/POST/DELETE)
 *  - /api/auth/admin-password (POST)
 *  - 그 외 admin 전용 라우트
 *
 * 참고: middleware는 `/api/admin/*` 만 보호함. `/api/auth/*` 는 공개 경로라
 *       여기서 직접 쿠키를 검증해야 한다.
 */

import { createHmac } from 'crypto';
import { getSessionSecret } from './sessionSecret';

const SECRET = getSessionSecret();
const ADMIN_COOKIE_NAME = 'admin_auth';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export async function isAdminAuthenticated(): Promise<boolean> {
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
    if (payload.ts && Date.now() - payload.ts > MAX_AGE_MS) return false;
    return true;
  } catch {
    return false;
  }
}
