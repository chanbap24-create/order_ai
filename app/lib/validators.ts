/**
 * 공용 입력 검증 유틸.
 * API route entry에서 쓰도록 설계 (엄격할수록 좋음).
 */

// 거래처 코드: 숫자·영문·`-`·`_` 만 허용, 최대 30자
const CLIENT_CODE_RE = /^[A-Za-z0-9_-]{1,30}$/;

export function isValidClientCode(code: unknown): code is string {
  return typeof code === 'string' && CLIENT_CODE_RE.test(code);
}

// 품목 코드: 좀 더 넓게 (마스터에 0NV801 같은 혼합 형식 존재)
const ITEM_NO_RE = /^[A-Za-z0-9]{1,20}$/;

export function isValidItemNo(itemNo: unknown): itemNo is string {
  return typeof itemNo === 'string' && ITEM_NO_RE.test(itemNo);
}

// YYYY-MM-DD 날짜
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(d: unknown): d is string {
  return typeof d === 'string' && DATE_RE.test(d);
}

// 매니저 이름: 한글/영문 2~20자 (space OK)
const MANAGER_NAME_RE = /^[가-힣A-Za-z ]{2,20}$/;

export function isValidManager(m: unknown): m is string {
  return typeof m === 'string' && MANAGER_NAME_RE.test(m);
}

/**
 * SSRF 방어: LLM 응답/DB wine.image_url 등 외부 제어 가능한 URL을 fetch 하기 전 검증.
 *  - http(s) 프로토콜만 허용
 *  - IP 주소 직접 지정 차단 (localhost/내부망/AWS metadata 등)
 *  - .local / IPv6 / localhost hostname 차단
 *  - DNS rebinding 완전 방어는 아니지만 80%는 막음
 */
export function isSafeFetchUrl(url: unknown): boolean {
  if (typeof url !== 'string' || !url) return false;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  const host = u.hostname.toLowerCase();
  // IPv4 직접 지정 차단
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return false;
  // IPv6 (대괄호 안에 콜론)
  if (host.includes(':') || host.startsWith('[')) return false;
  // 로컬 호스트
  if (host === 'localhost' || host === '0.0.0.0' || host.endsWith('.local') || host.endsWith('.internal')) return false;
  // 명시적 host 있어야 함 (정확한 도메인 포맷)
  if (!host.includes('.')) return false;
  return true;
}

/**
 * 업로드 크기/MIME 검증.
 * xlsx는 zip 기반이므로 magic bytes 'PK' 확인.
 */
export const MAX_UPLOAD_SIZE = 50 * 1024 * 1024; // 50MB

export function validateXlsxBuffer(buf: Buffer | ArrayBuffer | Uint8Array): { ok: boolean; error?: string } {
  const bytes = buf instanceof Buffer
    ? buf
    : Buffer.from(buf as ArrayBuffer);
  if (bytes.length === 0) return { ok: false, error: 'Empty file' };
  if (bytes.length > MAX_UPLOAD_SIZE) {
    return { ok: false, error: `File too large: ${bytes.length} bytes > ${MAX_UPLOAD_SIZE}` };
  }
  // ZIP magic number: 0x50 0x4B (PK)
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4B) {
    return { ok: false, error: 'Not an xlsx file (invalid ZIP signature)' };
  }
  return { ok: true };
}
