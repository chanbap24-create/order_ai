import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SALES_COOKIE = 'sales_auth';
const ADMIN_COOKIE = 'admin_auth';
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SALES_MAX_AGE = 7 * 24 * 60 * 60 * 1000;  // 7일
const ADMIN_MAX_AGE = 24 * 60 * 60 * 1000;       // 24시간

// --- base64url helpers (Edge Runtime) ---
function uint8ArrayToBase64url(arr: Uint8Array): string {
  let binary = '';
  for (const byte of arr) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64urlDecode(b64url: string): string {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  return atob(b64 + pad);
}

// --- HMAC-SHA256 token verification (Web Crypto API) ---
async function verifyToken(token: string): Promise<{ manager?: string; role?: string; ts?: number } | null> {
  if (!SECRET) return null;
  const dotIdx = token.indexOf('.');
  if (dotIdx < 0) return null;
  const b64 = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const sigBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(b64));
    const expected = uint8ArrayToBase64url(new Uint8Array(sigBytes));
    if (sig !== expected) return null;
    return JSON.parse(base64urlDecode(b64));
  } catch {
    return null;
  }
}

// 세일즈 토큰 검증 공통 함수
async function verifySalesToken(request: NextRequest): Promise<{ valid: boolean; payload?: any }> {
  const token = request.cookies.get(SALES_COOKIE)?.value;
  if (!token) return { valid: false };
  const payload = await verifyToken(token);
  if (!payload || !payload.manager) return { valid: false };
  if (payload.ts && Date.now() - payload.ts > SALES_MAX_AGE) return { valid: false };
  return { valid: true, payload };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── /api/auth/* → 항상 공개 ──
  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  // ── /api/sales/clients/managers → 로그인 드롭다운용 공개 ──
  if (pathname === '/api/sales/clients/managers') {
    return NextResponse.next();
  }

  // ── /api/admin/* 보호 (admin_auth 쿠키) ──
  if (pathname.startsWith('/api/admin')) {
    const token = request.cookies.get(ADMIN_COOKIE)?.value;
    if (!token) {
      return NextResponse.json({ error: '관리자 인증이 필요합니다.' }, { status: 401 });
    }
    const payload = await verifyToken(token);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: '유효하지 않은 관리자 세션입니다.' }, { status: 401 });
    }
    if (payload.ts && Date.now() - payload.ts > ADMIN_MAX_AGE) {
      return NextResponse.json({ error: '관리자 세션이 만료되었습니다. 다시 로그인해주세요.' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // ── /api/* 전체 보호 (sales_auth 쿠키) ──
  if (pathname.startsWith('/api/')) {
    const { valid, payload } = await verifySalesToken(request);
    if (!valid) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    const response = NextResponse.next();
    response.headers.set('x-manager', payload.manager);
    response.headers.set('x-role', payload.role || 'user');
    return response;
  }

  // ── 페이지 보호: 쿠키 없으면 /sales로 리다이렉트 ──
  // (페이지 자체는 데이터 없음, API 호출 시 HMAC 검증됨)
  const NO_CACHE = 'no-store, no-cache, must-revalidate, max-age=0';
  const token = request.cookies.get(SALES_COOKIE)?.value;
  if (!token || !token.includes('.')) {
    const res = NextResponse.redirect(new URL('/sales', request.url));
    res.headers.set('Cache-Control', NO_CACHE);
    return res;
  }
  // 페이로드에 manager 필드가 있는지 기본 확인
  try {
    const b64 = token.split('.')[0];
    const payload = JSON.parse(base64urlDecode(b64));
    if (!payload.manager) {
      const res = NextResponse.redirect(new URL('/sales', request.url));
      res.headers.set('Cache-Control', NO_CACHE);
      return res;
    }
  } catch {
    const res = NextResponse.redirect(new URL('/sales', request.url));
    res.headers.set('Cache-Control', NO_CACHE);
    return res;
  }

  // 인증 통과 - 캐시 방지 (로그아웃 후 뒤로가기 방지)
  const res = NextResponse.next();
  res.headers.set('Cache-Control', NO_CACHE);
  return res;
}

export const config = {
  matcher: [
    // API 전체
    '/api/:path*',
    // 보호할 페이지 (sales, admin 제외 - 자체 인증)
    '/order',
    '/inventory',
    '/glass',
    '/wine',
  ],
};
