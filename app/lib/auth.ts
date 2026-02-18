import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

const COOKIE_NAME = 'sales_auth';
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || 'fallback-secret-key';

// ── 비밀번호 해시 (bcrypt) ──
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // bcrypt.compare는 내부적으로 constant-time comparison 사용
  return bcrypt.compare(password, hash);
}

// ── 레거시 SHA-256 해시 (마이그레이션용) ──
function legacySha256Hash(password: string): string {
  return createHash('sha256').update(password + 'order-ai-salt').digest('hex');
}

/** 레거시 SHA-256 해시인지 확인 (bcrypt 해시는 $2로 시작) */
export function isLegacyHash(hash: string): boolean {
  return !hash.startsWith('$2');
}

/** 레거시 해시 검증 (타이밍 공격 방지) */
export function verifyLegacyPassword(password: string, hash: string): boolean {
  const inputHash = legacySha256Hash(password);
  try {
    return timingSafeEqual(Buffer.from(inputHash, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

// ── 세션 토큰 (HMAC 서명) ──
function signPayload(payload: object): string {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json).toString('base64url');
  const sig = createHmac('sha256', SECRET).update(b64).digest('base64url');
  return `${b64}.${sig}`;
}

function verifyToken(token: string): any | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [b64, sig] = parts;
  const expected = createHmac('sha256', SECRET).update(b64).digest('base64url');
  // 토큰 검증도 타이밍 공격 방지
  try {
    const sigBuf = Buffer.from(sig, 'base64url');
    const expectedBuf = Buffer.from(expected, 'base64url');
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;
  } catch {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(b64, 'base64url').toString());
  } catch {
    return null;
  }
}

// ── 세션 관리 ──
export interface SalesSession {
  manager: string;
  role: string; // 'admin' | 'user'
}

export async function createSession(manager: string, role: string): Promise<string> {
  const payload = { manager, role, ts: Date.now() };
  return signPayload(payload);
}

export async function getSession(): Promise<SalesSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload || !payload.manager) return null;

  return { manager: payload.manager, role: payload.role || 'user' };
}

export { COOKIE_NAME };
