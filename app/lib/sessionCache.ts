/**
 * sessionStorage TTL 캐시 헬퍼.
 * 재진입 시 네트워크 없이 즉시 표시 + 백그라운드 갱신 패턴용.
 *
 * 사용처:
 * - sales/meeting (holidays, import schedule)
 * - inventory (import schedule)
 * - sales auth (managers list)
 */

type Cached<T> = { value: T; at: number };

export function getCached<T>(key: string, ttlMs: number): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cached<T>;
    if (!parsed || typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > ttlMs) return null;
    return parsed.value;
  } catch {
    return null;
  }
}

export function setCached<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify({ value, at: Date.now() } as Cached<T>));
  } catch {
    /* storage full, ignore */
  }
}

export function clearCacheByPrefix(prefix: string) {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
    for (const k of keys) sessionStorage.removeItem(k);
  } catch { /* ignore */ }
}

export const CACHE_TTL = {
  HOLIDAYS: 24 * 60 * 60 * 1000, // 공휴일: 24시간
  IMPORT_SCHEDULE: 60 * 60 * 1000, // 수입일정: 1시간
  MANAGERS: 30 * 60 * 1000, // managers 30분
  COUNTRIES: 60 * 60 * 1000, // 국가 목록: 1시간
  ADMIN_DASHBOARD: 60 * 1000, // 재고분석 대시보드: 60초
  ADMIN_CLIENT_ANALYSIS: 30 * 1000, // 매출분석: 30초
};
