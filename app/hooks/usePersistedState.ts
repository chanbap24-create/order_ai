'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * sessionStorage 에 저장되는 useState — 탭/페이지 이동 후 돌아와도 상태 복원 (세션 한정).
 * SSR 안전(초기화 시 try/catch), 값은 JSON 직렬화.
 * 사용: const [q, setQ] = usePersistedState('client-list:q', '');
 */
export function usePersistedState<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const storageKey = `tab-state:${key}`;
  const loadedRef = useRef(false);
  const [value, setValue] = useState<T>(() => {
    loadedRef.current = true;
    try {
      const s = sessionStorage.getItem(storageKey);
      if (s != null) return JSON.parse(s) as T;
    } catch { /* SSR 또는 파싱 실패 */ }
    return initial;
  });

  const set = useCallback((v: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v;
      try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [storageKey]);

  return [value, set];
}
