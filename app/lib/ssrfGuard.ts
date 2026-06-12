// SSRF 방어 유틸 (Node 런타임 전용 — dns/net 사용).
//
// 사용자가 제공한 URL 로 서버가 외부 요청을 보내는 경우(로고 스크래핑 등),
// 내부 IP(메타데이터 169.254.169.254, 사설망, 루프백)로의 요청을 차단한다.
//  - http/https 만 허용
//  - 호스트를 DNS 해석해 모든 결과 IP 가 공인 대역인지 검사
//  - 리다이렉트는 수동 처리하여 각 홉마다 재검증
//
// 참고: DNS 사전검사 후 fetch 가 재해석하는 TOCTOU(DNS rebinding) 잔여 위험은 존재.
// 본 함수는 admin 전용 경로의 1차 방어로 충분하며, 완전 차단이 필요하면
// 해석된 IP 로 직접 연결(IP pinning)이 추가로 필요하다.

import dns from 'dns/promises';
import net from 'net';

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 0) return true;                       // 0.0.0.0/8
  if (a === 10) return true;                      // 사설
  if (a === 127) return true;                     // loopback
  if (a === 169 && b === 254) return true;        // link-local (클라우드 메타데이터)
  if (a === 172 && b >= 16 && b <= 31) return true; // 사설
  if (a === 192 && b === 168) return true;        // 사설
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a >= 224) return true;                      // multicast/reserved
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;        // loopback/unspecified
  if (lower.startsWith('fe80')) return true;                 // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA fc00::/7
  const mapped = lower.match(/::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/); // IPv4-mapped
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  return true; // 파싱 불가 → 차단
}

/** URL 이 공인 http/https 인지 검증. 실패 시 throw. 통과 시 정규화된 URL 반환. */
export async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error('잘못된 URL');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('http/https 프로토콜만 허용됩니다');
  }
  const host = u.hostname;
  // IP 리터럴이면 바로 검사
  if (net.isIP(host)) {
    if (isBlockedIp(host)) throw new Error('내부/사설 주소로의 요청은 차단됩니다');
    return u;
  }
  // 도메인이면 DNS 해석 후 모든 결과 검사 (사설로 해석되는 도메인 차단)
  const addrs = await dns.lookup(host, { all: true });
  if (addrs.length === 0) throw new Error('DNS 해석 실패');
  for (const a of addrs) {
    if (isBlockedIp(a.address)) throw new Error('호스트가 내부/사설 주소로 해석됩니다');
  }
  return u;
}

/**
 * SSRF 방어 fetch. 각 요청·리다이렉트 홉마다 공인 주소인지 검증한다.
 * 차단 대상이면 throw (호출 측이 try/catch 로 graceful 처리).
 */
export async function safeFetch(rawUrl: string, init?: RequestInit, maxRedirects = 3): Promise<Response> {
  let url = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertPublicHttpUrl(url);
    const res = await fetch(url, { ...init, redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return res;
      url = new URL(loc, url).href; // 상대 리다이렉트 해석 후 다음 루프에서 재검증
      continue;
    }
    return res;
  }
  throw new Error('리다이렉트가 너무 많습니다');
}
