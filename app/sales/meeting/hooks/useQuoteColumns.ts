import { useEffect, useState } from "react";
import { DEFAULT_MEETING_COLS } from "../constants";

const STORAGE_KEY = "meeting_quote_columns";

/** 견적서 컬럼 선택 상태 (localStorage 영구 저장) */
export function useQuoteColumns() {
  const [quoteCols, setQuoteCols] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return DEFAULT_MEETING_COLS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(quoteCols));
    } catch {}
  }, [quoteCols]);

  return { quoteCols, setQuoteCols };
}
