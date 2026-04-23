import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StatusFilter, WineWithStatus } from "../types";

/** 좌측 리스트 state + fetch + checkbox 관리 */
export function useNewWineList() {
  const [wines, setWines] = useState<WineWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // search 300ms debounce → API 호출 수 최소화
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search]);

  const fetchWines = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("status", "new");
    if (debouncedSearch) params.set("search", debouncedSearch);
    try {
      const res = await fetch(`/api/admin/wines?${params}`);
      const data = await res.json();
      if (data.success) setWines(data.data);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [debouncedSearch]);

  useEffect(() => {
    fetchWines();
  }, [fetchWines]);

  // wineStatus 는 클라이언트에서 필터 (data 에 이미 wine_status 포함) — 재 fetch 없이 즉각 반영
  const filteredWines = useMemo(() => {
    if (statusFilter === "all") return wines;
    return wines.filter((w) => w.wine_status === statusFilter);
  }, [wines, statusFilter]);

  const toggleCheck = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllChecks = () => {
    if (checkedIds.size === filteredWines.length) setCheckedIds(new Set());
    else setCheckedIds(new Set(filteredWines.map((w) => w.item_code)));
  };

  const counts = useMemo(() => ({
    all: wines.length,
    detected: wines.filter((w) => w.wine_status === "detected").length,
    researched: wines.filter((w) => w.wine_status === "researched").length,
    mismatch: wines.filter((w) => w.wine_status === "mismatch").length,
    approved: wines.filter((w) => w.wine_status === "approved").length,
  }), [wines]);

  return {
    wines: filteredWines, loading, search, setSearch,
    statusFilter, setStatusFilter,
    selectedId, setSelectedId,
    checkedIds, setCheckedIds, toggleCheck, toggleAllChecks,
    counts, fetchWines,
  };
}
