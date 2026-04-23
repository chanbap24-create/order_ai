import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "action_dismissed";
const TTL_MS = 7 * 86400000; // 7일

/**
 * 액션 카드 "확인 처리(dismiss)" 상태 관리.
 * localStorage에 저장하고 7일 후 자동 만료.
 */
export function useDismissed() {
  const [dismissed, setDismissed] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, string>;
      const now = Date.now();
      const valid: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (now - new Date(v).getTime() < TTL_MS) valid[k] = v;
      }
      setDismissed(valid);
      if (Object.keys(valid).length !== Object.keys(parsed).length) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
      }
    } catch {
      // ignore
    }
  }, []);

  const dismissItem = useCallback((key: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDismissed((prev) => {
      const next = { ...prev, [key]: new Date().toISOString() };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const clearDismissed = useCallback(() => {
    setDismissed({});
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  return { dismissed, dismissItem, clearDismissed };
}
