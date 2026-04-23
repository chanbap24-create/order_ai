import { useCallback, useEffect, useState } from "react";
import type { StatusFilter, WineWithStatus } from "../types";

/** 좌측 리스트 state + fetch + checkbox 관리 */
export function useNewWineList() {
  const [wines, setWines] = useState<WineWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const fetchWines = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("status", "new");
    if (search) params.set("search", search);
    if (statusFilter !== "all") params.set("wineStatus", statusFilter);
    try {
      const res = await fetch(`/api/admin/wines?${params}`);
      const data = await res.json();
      if (data.success) setWines(data.data);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => {
    fetchWines();
  }, [fetchWines]);

  const toggleCheck = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllChecks = () => {
    if (checkedIds.size === wines.length) setCheckedIds(new Set());
    else setCheckedIds(new Set(wines.map((w) => w.item_code)));
  };

  const counts = {
    all: wines.length,
    detected: wines.filter((w) => w.wine_status === "detected").length,
    researched: wines.filter((w) => w.wine_status === "researched").length,
    mismatch: wines.filter((w) => w.wine_status === "mismatch").length,
    approved: wines.filter((w) => w.wine_status === "approved").length,
  };

  return {
    wines, loading, search, setSearch,
    statusFilter, setStatusFilter,
    selectedId, setSelectedId,
    checkedIds, setCheckedIds, toggleCheck, toggleAllChecks,
    counts, fetchWines,
  };
}
