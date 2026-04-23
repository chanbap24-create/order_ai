import { useCallback, useEffect, useState } from "react";

/**
 * 세션 기반 견적서 분리를 위한 manager 식별자.
 *
 * 값 의미:
 * - `''`       : 로드 전 (세션 아직 확인 안 됨)
 * - `'__loaded__'` : 비인증 상태로 확정 (manager 없음, 전역 견적 사용)
 * - 그 외 문자열 : 인증된 사용자 manager name
 */
export function useQuoteManager() {
  const [quoteManager, setQuoteManager] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data.authenticated && data.manager) {
          setQuoteManager(data.manager);
        } else {
          setQuoteManager("__loaded__");
        }
      } catch {
        setQuoteManager("__loaded__");
      }
    })();
  }, []);

  /** API 쿼리에 붙일 manager 파라미터 값 (미인증/로드전엔 빈 문자열) */
  const getManagerParam = useCallback((): string => {
    if (!quoteManager || quoteManager === "__loaded__") return "";
    return quoteManager;
  }, [quoteManager]);

  return { quoteManager, getManagerParam };
}
