import { useCallback, useEffect, useRef, useState } from "react";
import { DEBOUNCE_MS } from "../constants";
import { searchWines } from "../lib/api";
import type { OrderTab, SearchResult } from "../types";

/**
 * 수동 와인/글라스 검색. 특정 라인(`searchIdx`)에 대해 쿼리를 입력받아 300ms debounce로 검색.
 * - 외부 클릭 시 검색 박스 닫기 (Ref 반환)
 */
export function useWineSearch(tab: OrderTab) {
  const [idx, setIdx] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const run = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const list = await searchWines(q, tab);
        setResults(list);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [tab],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (idx !== null) void run(query);
    }, DEBOUNCE_MS.wineSearch);
    return () => clearTimeout(timer);
  }, [query, idx, run]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIdx(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const close = () => {
    setIdx(null);
    setQuery("");
    setResults([]);
  };

  return {
    idx,
    setIdx,
    query,
    setQuery,
    results,
    loading,
    ref,
    close,
  };
}
