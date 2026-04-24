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
  IMPORT_SCHEDULE: 2 * 60 * 1000, // 수입일정: 2분 (admin 업로드 반영 지연 최소화)
  MANAGERS: 30 * 60 * 1000, // managers 30분
  COUNTRIES: 60 * 60 * 1000, // 국가 목록: 1시간
  ADMIN_DASHBOARD: 60 * 1000, // 재고분석 대시보드: 60초
  ADMIN_CLIENT_ANALYSIS: 30 * 1000, // 매출분석: 30초
};

/**
 * 데이터 갱신 이벤트 브로드캐스트 유틸.
 * admin 업로드 후 다른 탭/페이지의 sessionStorage 캐시를 무효화할 때 사용.
 * storage 이벤트 활용 (localStorage.setItem → 다른 탭에서 이벤트 수신).
 */
const EVENT_PREFIX = "data_invalidated:";

export function broadcastDataInvalidation(key: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(EVENT_PREFIX + key, String(Date.now()));
  } catch { /* ignore */ }
}

/**
 * 다른 탭의 invalidation 이벤트 구독.
 * @param key invalidation 이벤트 key (예: 'import_schedule')
 * @param handler 이벤트 수신 시 호출할 함수 (fresh fetch 유발 등)
 * @returns unsubscribe 함수
 */
export function subscribeDataInvalidation(key: string, handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const full = EVENT_PREFIX + key;
  const listener = (e: StorageEvent) => {
    if (e.key === full) handler();
  };
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}
