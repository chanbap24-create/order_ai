import { useCallback, useEffect, useRef, useState } from "react";

/** preference 변경 사항 응답을 서버로 전달하는 debounced PUT */
async function putPreference(key: string, value: unknown): Promise<void> {
  try {
    await fetch("/api/user/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
  } catch (e) {
    console.error("[prefs] PUT failed:", key, e);
  }
}

type LoadState = "idle" | "loading" | "loaded" | "anonymous";

type UsePrefsResult = {
  /** 서버 응답 로드 상태 */
  state: LoadState;
  /** 단일 key 읽기 — 로드 전이면 undefined */
  get: <T = unknown>(key: string) => T | undefined;
  /** 단일 key 저장 (optimistic + debounced 서버 업서트) */
  set: <T>(key: string, value: T) => void;
  /** localStorage 캐시도 함께 저장 (offline fallback) */
  setWithCache: <T>(key: string, value: T) => void;
};

/**
 * 사용자 preference 훅.
 *
 * 동작:
 *  1. 마운트 시 GET /api/user/preferences → 내부 map 채움
 *  2. get(key): map에서 즉시 반환
 *  3. set(key, value): map 즉시 갱신 + 500ms debounce 후 서버 PUT
 *  4. setWithCache: localStorage에도 즉시 저장 (비로그인/오프라인 초기 로드용)
 *
 * 세션 없으면 state='anonymous' — 호출자는 localStorage로 폴백해야 함.
 */
export function useServerPreferences(): UsePrefsResult {
  const [state, setState] = useState<LoadState>("idle");
  const mapRef = useRef<Record<string, unknown>>({});
  const [, forceTick] = useState(0);
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // 마운트 시 서버에서 한 번 fetch
  useEffect(() => {
    let cancelled = false;
    setState("loading");
    (async () => {
      try {
        const res = await fetch("/api/user/preferences");
        if (res.status === 401) {
          if (!cancelled) setState("anonymous");
          return;
        }
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (json?.preferences && typeof json.preferences === "object") {
          mapRef.current = { ...json.preferences };
        }
        setState("loaded");
      } catch (e) {
        console.error("[prefs] GET failed:", e);
        if (!cancelled) setState("anonymous");
      }
    })();

    const timers = timersRef.current;
    return () => {
      cancelled = true;
      Object.values(timers).forEach((t) => clearTimeout(t));
    };
  }, []);

  const get = useCallback(<T>(key: string): T | undefined => {
    const v = mapRef.current[key];
    return v === undefined ? undefined : (v as T);
  }, []);

  const set = useCallback(<T>(key: string, value: T) => {
    mapRef.current = { ...mapRef.current, [key]: value };
    forceTick((n) => n + 1);

    // debounce per key
    const prev = timersRef.current[key];
    if (prev) clearTimeout(prev);
    timersRef.current[key] = setTimeout(() => {
      void putPreference(key, value);
      delete timersRef.current[key];
    }, 500);
  }, []);

  const setWithCache = useCallback(
    <T>(key: string, value: T) => {
      set(key, value);
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem(key, JSON.stringify(value));
        }
      } catch {
        // quota or unavailable — ignore
      }
    },
    [set],
  );

  return { state, get, set, setWithCache };
}

/**
 * 서버 prefs + localStorage fallback을 결합해서 초기값을 결정한다.
 * - state가 'loaded'면 서버 값 우선, 없으면 localStorage 파싱값, 그것도 없으면 defaultValue
 * - state가 'anonymous'면 localStorage만
 * - state가 'loading'이면 localStorage (서버 응답 오면 자동 덮어씀)
 */
export function readInitialPreference<T>(
  key: string,
  defaultValue: T,
  serverValue: T | undefined,
  state: LoadState,
): T {
  if (state === "loaded" && serverValue !== undefined) return serverValue;
  if (typeof window === "undefined") return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) return JSON.parse(raw) as T;
  } catch {
    // ignore
  }
  return defaultValue;
}
