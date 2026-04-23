/**
 * sessionStorage TTL 캐시 헬퍼.
 * 재진입 시 네트워크 없이 즉시 표시 + 백그라운드 갱신.
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

export const CACHE_TTL = {
  HOLIDAYS: 24 * 60 * 60 * 1000, // 공휴일: 24시간
  IMPORT_SCHEDULE: 60 * 60 * 1000, // 수입일정: 1시간
  MANAGERS: 30 * 60 * 1000, // managers: 30분
};
