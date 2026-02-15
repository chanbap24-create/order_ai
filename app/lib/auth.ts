import { createHash, createHmac, randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { supabase } from './db';

const COOKIE_NAME = 'sales_auth';
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || 'fallback-secret-key';

// ── 비밀번호 해시 ──
export function hashPassword(password: string): string {
  return createHash('sha256').update(password + 'order-ai-salt').digest('hex');
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
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
  if (sig !== expected) return null;
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
