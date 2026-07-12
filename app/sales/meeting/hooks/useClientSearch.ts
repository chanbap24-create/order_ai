import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientOption } from "../types";

/**
 * 거래처 목록 프리로드 (담당자별 1회) + 로컬 검색 필터링.
 *
 * 성능 최적화: mount 시가 아니라 **첫 모달 오픈 시점**에 `ensureLoaded()` 호출.
 * 500개+ 페이로드를 초기 네트워크 경로에서 제거.
 */
export function useClientSearch(manager: string) {
  const cache = useRef<{ manager: string; clients: ClientOption[] }>({
    manager: "",
    clients: [],
  });
  const inflightRef = useRef<Promise<void> | null>(null);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<ClientOption[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadAll = useCallback(async (mgr: string) => {
    if (cache.current.manager === mgr && cache.current.clients.length > 0) return;
    if (inflightRef.current) return inflightRef.current;
    const promise = (async () => {
      try {
        // 담당 거래처가 500곳을 넘을 수 있어(조성재 1,100+) 전부 로드될 때까지 페이지 반복.
        const all: ClientOption[] = [];
        for (let page = 1; page <= 10; page++) {
          const params = new URLSearchParams({ limit: "500", page: String(page), type: "wine" });
          if (mgr) params.set("manager", mgr);
          const res = await fetch(`/api/sales/clients?${params}`);
          const json = await res.json();
          const batch: ClientOption[] = json.clients || [];
          all.push(...batch);
          if (batch.length < 500) break;
        }
        cache.current = { manager: mgr, clients: all };
      } catch {
        /* ignore */
      } finally {
        inflightRef.current = null;
      }
    })();
    inflightRef.current = promise;
    return promise;
  }, []);

  /** 모달 오픈 시점에 호출. 이미 같은 manager로 로드되어 있으면 no-op. */
  const ensureLoaded = useCallback(() => {
    void loadAll(manager);
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

  return {
    search, setSearch,
    options, showDropdown, setShowDropdown,
    dropdownRef,
    ensureLoaded,
  };
}
