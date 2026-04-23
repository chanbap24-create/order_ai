import { useCallback, useEffect, useRef, useState } from "react";
import { DEBOUNCE_MS } from "../constants";
import { fetchClients } from "../lib/api";
import type { Client, OrderTab } from "../types";

/**
 * 거래처 검색 + 드롭다운 상태 관리.
 * - 쿼리 변경 시 300ms debounce 후 서버 검색
 * - AbortController로 이전 요청 취소
 * - 외부 클릭 시 드롭다운 닫기 (Ref 반환)
 */
export function useClientSearch(tab: OrderTab) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Client[]>([]);
  const [selected, setSelected] = useState<Client | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(
    async (q: string) => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const list = await fetchClients(q, tab, controller.signal);
        if (!controller.signal.aborted) setResults(list);
      } catch (e: any) {
        if (e?.name !== "AbortError") setResults([]);
      }
    },
    [tab],
  );

  useEffect(() => {
    if (!showDropdown || !query.trim()) {
      if (!query.trim()) setResults([]);
      return;
    }
    const timer = setTimeout(() => search(query), DEBOUNCE_MS.clientSearch);
    return () => clearTimeout(timer);
  }, [query, showDropdown, search]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const reset = () => {
    setQuery("");
    setResults([]);
    setSelected(null);
    setShowDropdown(false);
  };

  const pick = (c: Client) => {
    setSelected(c);
    setQuery(c.client_name);
    setShowDropdown(false);
  };

  return {
    query,
    setQuery,
    results,
    selected,
    setSelected,
    showDropdown,
    setShowDropdown,
    dropdownRef,
    pick,
    reset,
  };
}
