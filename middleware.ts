import { NextResponse } from 'next/server';
import type { NextRequest, NextFetchEvent } from 'next/server';
import { rateLimit, maybeCleanup } from '@/app/lib/rateLimit';
import { classifyFeature, trackFeatureUsage } from '@/app/lib/featureUsage';
import { getSessionSecret } from '@/app/lib/sessionSecret';

const SALES_COOKIE = 'sales_auth';
const ADMIN_COOKIE = 'admin_auth';
// 세션 서명 시크릿 (auth.ts 와 반드시 동일). 프로덕션에서 AUTH_SECRET 미설정 시
// fail-closed(throw) — DB 키와 세션 키 분리 강제. sessionSecret.ts 참고.
const SECRET = getSessionSecret();
// 원격 동기화 에이전트용 bearer 토큰 (선택).
const REMOTE_SYNC_TOKEN = process.env.REMOTE_SYNC_TOKEN || '';
const SALES_MAX_AGE = 7 * 24 * 60 * 60 * 1000;  // 7일
const ADMIN_MAX_AGE = 24 * 60 * 60 * 1000;       // 24시간

// --- base64url helpers (Edge Runtime) ---
function base64urlToUint8Array(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const binary = atob(b64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// payload(JSON) 디코드. atob만 쓰면 UTF-8 멀티바이트(한글 등)가 latin-1로 오역됨 → TextDecoder 필수.
function base64urlDecodeUtf8(b64url: string): string {
  return new TextDecoder('utf-8').decode(base64urlToUint8Array(b64url));
}

// --- HMAC-SHA256 token verification (Web Crypto API) ---
// crypto.subtle.verify로 바이트 직접 비교 → base64url 인코딩 차이 문제 회피
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
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'],
    );
    const sigBytes = base64urlToUint8Array(sig);
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(b64));
    if (!valid) return null;
    return JSON.parse(base64urlDecodeUtf8(b64));
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

/**
 * 요청별 IP 키 생성.
 * Vercel은 x-forwarded-for 첫 IP가 실제 클라이언트.
 */
function clientIp(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for') || '';
  return fwd.split(',')[0].trim() || 'unknown';
}

/**
 * 경로별 rate limit 체크.
 *  - /api/auth/* : 로그인 무차별 대입 방어 (분당 10회)
 *  - /api/admin/upload* : 업로드 스팸 방어 (분당 20회)
 *  - 기타 /api/* : 일반 트래픽 (분당 240회 = 초당 4회)
 * @returns null = 허용, NextResponse = 차단
 */
function applyRateLimit(request: NextRequest, pathname: string): NextResponse | null {
  maybeCleanup();
  const ip = clientIp(request);

  let limit: number, windowMs: number, bucketKey: string;
  if (pathname === '/api/auth/me') {
    // 세션 확인용 GET — 페이지 진입마다 호출되므로 일반 트래픽 limit 적용.
    // brute force 위험 없음 (로그인/비번 변경이 아님).
    limit = 240;
    windowMs = 60_000;
    bucketKey = `api:${ip}`;
  } else if (pathname.startsWith('/api/auth/')) {
    // login/password/setup 등 brute force 방어용 — 분당 20회
    limit = 20;
    windowMs = 60_000;
    bucketKey = `auth:${ip}`;
  } else if (pathname.startsWith('/api/admin/upload') || pathname.startsWith('/api/admin/remote-sync/upload')) {
    limit = 20;
    windowMs = 60_000;
    bucketKey = `upload:${ip}`;
  } else if (pathname.startsWith('/api/')) {
    limit = 240;
    windowMs = 60_000;
    bucketKey = `api:${ip}`;
  } else {
    return null;
  }

  const { allowed, remaining, resetIn } = rateLimit(bucketKey, limit, windowMs);
  if (!allowed) {
    return new NextResponse(
      JSON.stringify({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil(resetIn / 1000)),
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(resetIn / 1000)),
        },
      },
    );
  }

  // 허용 시 헤더만 추가 (NextResponse.next()는 다음 블록에서 처리)
  request.headers.set('x-ratelimit-remaining', String(remaining));
  return null;
}

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;

  // ── Rate limit 체크 (API만) ──
  const rlBlocked = applyRateLimit(request, pathname);
  if (rlBlocked) return rlBlocked;

  // ── /api/auth/* → 항상 공개 ──
  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  // ── /api/cron/* → 라우트가 CRON_SECRET/admin 자체 검증 ──
  if (pathname.startsWith('/api/cron/')) {
    return NextResponse.next();
  }

  // ── /api/sales/clients/managers → 로그인 드롭다운용 공개 ──
  if (pathname === '/api/sales/clients/managers') {
    return NextResponse.next();
  }

  // ── /api/forecast/* + /api/marketing/* → 인증 비강제. 단, 토큰 있으면 사용량 추적 ──
  if (pathname.startsWith('/api/forecast') || pathname.startsWith('/api/marketing')) {
    if (request.headers.get('x-track-skip') !== '1') {
      const { valid: v2, payload: p2 } = await verifySalesToken(request);
      if (v2 && p2?.manager) {
        const f = classifyFeature(request.method, pathname);
        if (f) event.waitUntil(trackFeatureUsage(p2.manager, f));
      }
    }
    return NextResponse.next();
  }

  // ── /api/admin/remote-sync → 로컬 에이전트 전용: Bearer 토큰 or admin_auth ──
  // REMOTE_SYNC_TOKEN 미설정 시 외부 공개를 차단 (admin_auth 쿠키만 허용).
  if (pathname.startsWith('/api/admin/remote-sync')) {
    const authHeader = request.headers.get('authorization') || '';
    if (REMOTE_SYNC_TOKEN && authHeader === `Bearer ${REMOTE_SYNC_TOKEN}`) {
      return NextResponse.next();
    }
    // 폴백: 웹 UI에서 호출하는 경우 admin_auth 쿠키 검증
    const adminToken = request.cookies.get(ADMIN_COOKIE)?.value;
    if (adminToken) {
      const ap = await verifyToken(adminToken);
      if (ap?.role === 'admin' && (!ap.ts || Date.now() - ap.ts <= ADMIN_MAX_AGE)) {
        return NextResponse.next();
      }
    }
    return NextResponse.json(
      { error: '원격 동기화 인증이 필요합니다. REMOTE_SYNC_TOKEN 또는 관리자 세션 필요.' },
      { status: 401 },
    );
  }

  // ── /api/admin 중 세일즈도 읽기 가능한 경로 (GET only) ──
  const ADMIN_READ_ALLOWED = ['/api/admin/upload-data/import-schedule'];
  if (ADMIN_READ_ALLOWED.includes(pathname) && request.method === 'GET') {
    // admin_auth 또는 sales_auth 둘 다 허용
    const adminToken = request.cookies.get(ADMIN_COOKIE)?.value;
    if (adminToken) {
      const ap = await verifyToken(adminToken);
      if (ap?.role === 'admin' && (!ap.ts || Date.now() - ap.ts <= ADMIN_MAX_AGE)) {
        return NextResponse.next();
      }
    }
    const { valid } = await verifySalesToken(request);
    if (valid) return NextResponse.next();
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
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
    // 사용량 추적 (best-effort, fire-and-forget)
    // X-Track-Skip 헤더가 있으면 추적 제외 (배경 가용성 체크 같은 부수 호출용).
    if (request.headers.get('x-track-skip') !== '1') {
      const feature = classifyFeature(request.method, pathname);
      if (feature && payload.manager) {
        event.waitUntil(trackFeatureUsage(payload.manager, feature));
      }
    }
    // 응답 헤더에 매니저/역할 노출 금지 (브라우저/확장 leak 방지).
    // 라우트는 getSession() 으로 세션 정보를 직접 읽으므로 헤더 미노출이 안전.
    return NextResponse.next();
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
    const payload = JSON.parse(base64urlDecodeUtf8(b64));
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
    // 보호할 페이지 (sales 로그인 페이지 제외 - 자체 인증)
    '/order',
    '/order-v2',
    '/stock',
    '/inventory',
    '/glass',
    '/wine',
    '/quote',
    '/marketing',
  ],
};
