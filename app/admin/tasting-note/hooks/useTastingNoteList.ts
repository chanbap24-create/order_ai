import { useCallback, useEffect, useState } from "react";
import type { NoteFilter, TastingWineRow } from "../types";
import { isWineCategory, LOW_STOCK_THRESHOLD } from "../constants";

/** TastingNote 리스트: debounced search + ghIndex + hideZero/wineOnly/lowStock 필터 + 노트 필터 */
export function useTastingNoteList() {
  const [wines, setWines] = useState<TastingWineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterNote, setFilterNote] = useState<NoteFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [hideZero, setHideZero] = useState(true);
  // 미작성 탭은 와인 위주 업데이트를 위한 곳이라 기본 ON.
  const [wineOnly, setWineOnly] = useState(true);
  // 재고가 1 ~ LOW_STOCK_THRESHOLD 병인 와인만 보기 (기본 OFF).
  const [lowStock, setLowStock] = useState(false);
  const [ghIndex, setGhIndex] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // GitHub 인덱스 로드 (1회)
  useEffect(() => {
    fetch("/api/tasting-notes")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.notes) {
          const map: Record<string, boolean> = {};
          for (const [code, info] of Object.entries(
            d.notes as Record<string, { exists?: boolean }>,
          )) {
            if (info?.exists) map[code] = true;
          }
          setGhIndex(map);
        }
      })
      .catch(() => {});
  }, []);

  const fetchWines = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    try {
      const res = await fetch(`/api/admin/tasting-notes?${params}`);
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

  const hasNote = (w: TastingWineRow) =>
    !!(w.tasting_note_id || ghIndex[w.item_code]);

  /** hideZero/wineOnly/lowStock 등 카테고리·재고 기반 1차 필터 (filterNote 와 무관) */
  const passesCategoryFilters = (w: TastingWineRow): boolean => {
    const stock = (w.inv_available || 0) + (w.inv_bonded || 0);
    if (hideZero && stock <= 0) return false;
    if (wineOnly && !isWineCategory(w.item_code)) return false;
    if (lowStock && (stock <= 0 || stock > LOW_STOCK_THRESHOLD)) return false;
    return true;
  };

  const filteredWines = wines.filter((w) => {
    if (!passesCategoryFilters(w)) return false;
    if (filterNote === "with") return hasNote(w);
    if (filterNote === "without") return !hasNote(w);
    if (filterNote === "db-only") return !!w.tasting_note_id && !ghIndex[w.item_code];
    return true;
  });

  // 노트 필터별 카운트는 카테고리·재고 1차 필터를 적용한 결과를 기준으로 계산.
  const baseFiltered = wines.filter(passesCategoryFilters);
  const counts: Record<NoteFilter, number> = {
    all: baseFiltered.length,
    with: baseFiltered.filter((w) => hasNote(w)).length,
    without: baseFiltered.filter((w) => !hasNote(w)).length,
    "db-only": baseFiltered.filter(
      (w) => !!w.tasting_note_id && !ghIndex[w.item_code],
    ).length,
  };

  const toggleCheck = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllChecks = () => {
    const ids = filteredWines.map((w) => w.item_code);
    if (checkedIds.size === ids.length) setCheckedIds(new Set());
    else setCheckedIds(new Set(ids));
  };

  return {
    wines, filteredWines, loading,
    search, setSearch,
    filterNote, setFilterNote,
    hideZero, setHideZero,
    wineOnly, setWineOnly,
    lowStock, setLowStock,
    ghIndex, counts,
    selectedId, setSelectedId,
    checkedIds, setCheckedIds, toggleCheck, toggleAllChecks,
    fetchWines, hasNote,
  };
}
