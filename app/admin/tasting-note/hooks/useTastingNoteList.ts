import { useCallback, useEffect, useState } from "react";
import type { NoteFilter, TastingWineRow } from "../types";

/** TastingNote 리스트: debounced search + ghIndex + hideZero 재고 필터 + 노트 필터 */
export function useTastingNoteList() {
  const [wines, setWines] = useState<TastingWineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterNote, setFilterNote] = useState<NoteFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [hideZero, setHideZero] = useState(true);
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

  const filteredWines = wines.filter((w) => {
    if (hideZero && ((w.inv_available || 0) + (w.inv_bonded || 0)) <= 0) return false;
    if (filterNote === "with") return hasNote(w);
    if (filterNote === "without") return !hasNote(w);
    if (filterNote === "db-only") return !!w.tasting_note_id && !ghIndex[w.item_code];
    return true;
  });

  const stockFiltered = hideZero
    ? wines.filter((w) => (w.inv_available || 0) + (w.inv_bonded || 0) > 0)
    : wines;
  const counts: Record<NoteFilter, number> = {
    all: stockFiltered.length,
    with: stockFiltered.filter((w) => hasNote(w)).length,
    without: stockFiltered.filter((w) => !hasNote(w)).length,
    "db-only": stockFiltered.filter(
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
    ghIndex, counts,
    selectedId, setSelectedId,
    checkedIds, setCheckedIds, toggleCheck, toggleAllChecks,
    fetchWines, hasNote,
  };
}
