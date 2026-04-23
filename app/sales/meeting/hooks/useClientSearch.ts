import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientOption } from "../types";

/**
 * 거래처 목록 프리로드 (담당자별 1회) + 로컬 검색 필터링.
 */
export function useClientSearch(manager: string) {
  const cache = useRef<{ manager: string; clients: ClientOption[] }>({
    manager: "",
    clients: [],
  });
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<ClientOption[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadAll = useCallback(async (mgr: string) => {
    if (cache.current.manager === mgr && cache.current.clients.length > 0) return;
    try {
      const params = new URLSearchParams({ limit: "500", type: "wine" });
      if (mgr) params.set("manager", mgr);
      const res = await fetch(`/api/sales/clients?${params}`);
      const json = await res.json();
      cache.current = { manager: mgr, clients: json.clients || [] };
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadAll(manager);
  }, [manager, loadAll]);

  useEffect(() => {
    if (search.length >= 1) {
      const q = search.toLowerCase();
      const filtered = cache.current.clients
        .filter(
          (c) =>
            c.client_name.toLowerCase().includes(q) ||
            c.client_code.toLowerCase().includes(q),
        )
        .slice(0, 30);
      setOptions(filtered);
      setShowDropdown(true);
    } else {
      setOptions([]);
      setShowDropdown(false);
    }
  }, [search]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return { search, setSearch, options, showDropdown, setShowDropdown, dropdownRef };
}
