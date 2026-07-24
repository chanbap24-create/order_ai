import { useCallback, useEffect, useState } from "react";
import type { NoteFilter, TastingWineRow } from "../types";
import { isWineCategory, isActionableNew, LOW_STOCK_THRESHOLD } from "../constants";

/** TastingNote 리스트: debounced search + ghIndex + hideZero/wineOnly/lowStockThreshold 필터 + 노트 필터 */
export function useTastingNoteList(initialFilter: NoteFilter = "all") {
  const [wines, setWines] = useState<TastingWineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterNote, setFilterNote] = useState<NoteFilter>(initialFilter);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [hideZero, setHideZero] = useState(true);
  // 미작성 탭은 와인 위주 업데이트를 위한 곳이라 기본 ON.
  const [wineOnly, setWineOnly] = useState(true);
  // 재고 lowStockThreshold 병 이하 와인을 숨김. 0 이면 필터 OFF.
  // 사용자가 input 으로 직접 조정 — 별도 토글 없이 값만으로 ON/OFF. 기본값 10병.
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(LOW_STOCK_THRESHOLD);
  // 제외 보기: OFF(기본)면 제외 품목 숨김, ON이면 제외 품목만 표시(복원용)
  const [showExcluded, setShowExcluded] = useState(false);
  const [ghIndex, setGhIndex] = useState<Record<string, boolean>>({});
  // PDF 인덱스 로드 실패 여부. true 면 PDF 보유 여부를 알 수 없어
  // 신규/미작성/작성완료 카운트가 부정확할 수 있음 → UI 경고로 노출.
  const [ghError, setGhError] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  /**
   * GitHub PDF 인덱스 로드. force=true 시 서버·CDN 캐시까지 우회.
   * 업로드 직후 호출하면 새로 올린 PDF 가 즉시 ghIndex 에 반영됨.
   */
  const refreshGhIndex = useCallback(async (force = false): Promise<boolean> => {
    const url = force ? "/api/tasting-notes?refresh=1" : "/api/tasting-notes";
    // 일시적 네트워크/서버 오류에 대비해 최대 3회 재시도(지수 백오프).
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        if (!d.success || !d.notes) throw new Error("invalid response");
        const map: Record<string, boolean> = {};
        for (const [code, info] of Object.entries(
          d.notes as Record<string, { exists?: boolean }>,
        )) {
          if (info?.exists) map[code] = true;
        }
        setGhIndex(map);
        setGhError(false);
        return true;
      } catch {
        if (attempt < 2) {
          await new Promise((res) => setTimeout(res, 500 * (attempt + 1)));
        }
      }
    }
    // 끝까지 실패: 기존 ghIndex 는 덮어쓰지 않고(오판 방지) 에러만 표시.
    setGhError(true);
    return false;
  }, []);

  // 마운트 시 1회 로드 (캐시 허용)
  useEffect(() => {
    refreshGhIndex(false);
  }, [refreshGhIndex]);

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

  /** hideZero/wineOnly/lowStockThreshold 등 카테고리·재고 기반 1차 필터 (filterNote 와 무관) */
  const passesCategoryFilters = (w: TastingWineRow): boolean => {
    if (showExcluded !== !!w.note_excluded) return false; // 기본: 제외 숨김 / 제외 보기: 제외만
    const stock = (w.inv_available || 0) + (w.inv_bonded || 0);
    if (hideZero && stock <= 0) return false;
    if (wineOnly && !isWineCategory(w.item_code)) return false;
    if (lowStockThreshold > 0 && stock <= lowStockThreshold) return false;
    return true;
  };

  /** 품목을 노트 목록에서 제외/복원 */
  const setExcluded = async (itemCode: string, excluded: boolean) => {
    try {
      await fetch(`/api/admin/tasting-notes/${itemCode}/exclude`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ excluded }),
      });
      await fetchWines();
    } catch {
      alert("제외 처리에 실패했습니다.");
    }
  };

  // 신규: status=new · 재고합>0 · 노트 미등록 · 제외상태 일치 · 와인분류(토글) — 공유 규칙
  const isNewWine = (w: TastingWineRow) =>
    isActionableNew(w, hasNote(w), { requireWineCategory: wineOnly, showExcluded });

  const filteredWines = wines.filter((w) => {
    if (filterNote === "new") return isNewWine(w);
    if (filterNote === "dept") return !!w.dept_batch; // 백화점 유입분은 카테고리 필터 무관하게 전부
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
    new: wines.filter(isNewWine).length,
    with: baseFiltered.filter((w) => hasNote(w)).length,
    without: baseFiltered.filter((w) => !hasNote(w)).length,
    "db-only": baseFiltered.filter(
      (w) => !!w.tasting_note_id && !ghIndex[w.item_code],
    ).length,
    dept: wines.filter((w) => !!w.dept_batch).length,
  };

  // 탭 배지용: 토글(와인만/제외됨)과 무관한 안정적 "신규 작업대상" 목록/수
  const newWines = wines.filter((w) =>
    isActionableNew(w, hasNote(w), { requireWineCategory: true, showExcluded: false }),
  );
  const newActionableCount = newWines.length;

  /** 전체 재조회 없이 리스트의 단일 행만 갱신 (편집 시 정렬/스크롤 유지용) */
  const patchWine = (itemCode: string, patch: Partial<TastingWineRow>) =>
    setWines((prev) => prev.map((w) => (w.item_code === itemCode ? { ...w, ...patch } : w)));

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
    lowStockThreshold, setLowStockThreshold,
    showExcluded, setShowExcluded, setExcluded,
    ghIndex, ghError, refreshGhIndex, counts, newActionableCount, newWines,
    selectedId, setSelectedId,
    checkedIds, setCheckedIds, toggleCheck, toggleAllChecks,
    fetchWines, patchWine, hasNote,
  };
}
