import { useCallback, useEffect, useState } from "react";
import { applyClientFilters } from "../lib/filterResults";
import type { AdvancedFilters, InventoryItem, WarehouseTab } from "../types";
import { EMPTY_ADVANCED_FILTERS } from "../types";
import type { ImportScheduleItem } from "./useImportSchedule";

type SavedSearchState = {
  searchQuery?: string;
  activeTab?: WarehouseTab;
  hideNoSupplyPrice?: boolean;
  hideNoStock?: boolean;
  showOnlyBondedStock?: boolean;
  advancedFilters?: Partial<AdvancedFilters>;
  results?: InventoryItem[];
};

const SESSION_KEY = "inv_search_state";

type Params = {
  activeTab: WarehouseTab;
  /** CDV 탭에서 수입 일정과 병합 검색하기 위한 맵 */
  importScheduleMap: Record<string, ImportScheduleItem[]>;
  /** 테이스팅 노트 인덱스 (page mount 시 한 번에 로드된 set). 검색 결과를 set 으로 매핑 — N+1 fetch 제거 */
  tastingNoteSet: Set<string>;
  /** 검색 결과 중 set 에 포함된 품번을 부모 맵에 마킹 */
  onCheckTastingNote: (itemNo: string) => void;
};

/**
 * 재고 검색 + 고급 필터 + 클라이언트 측 필터링 + sessionStorage 복원/저장.
 */
export function useInventorySearch(p: Params) {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<InventoryItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState("");
  const [hideNoSupplyPrice, setHideNoSupplyPrice] = useState(true);
  const [hideNoStock, setHideNoStock] = useState(true);
  const [showOnlyBondedStock, setShowOnlyBondedStock] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(
    EMPTY_ADVANCED_FILTERS,
  );

  // sessionStorage 복원 (1회)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (!saved) return;
      const s: SavedSearchState = JSON.parse(saved);
      if (s.searchQuery) setSearchQuery(s.searchQuery);
      if (typeof s.hideNoSupplyPrice === "boolean") setHideNoSupplyPrice(s.hideNoSupplyPrice);
      if (typeof s.hideNoStock === "boolean") setHideNoStock(s.hideNoStock);
      if (typeof s.showOnlyBondedStock === "boolean") setShowOnlyBondedStock(s.showOnlyBondedStock);
      if (s.advancedFilters) {
        setAdvancedFilters((prev) => ({ ...prev, ...s.advancedFilters } as AdvancedFilters));
      }
      // results 는 sessionStorage 미저장(가격 leak 방지). hasSearched 는 false 유지 → 사용자 다시 검색 필요.
    } catch {
      // ignore
    }
  }, []);

  // sessionStorage 저장 (debounced via dep change). 가격/재고 등 민감 필드는 제외 — XSS 1회로
  // 가격 정책 leak 방지. 복원 시에는 query/filter 만 살리고 results 는 재검색 트리거.
  useEffect(() => {
    try {
      const state: SavedSearchState = {
        searchQuery,
        activeTab: p.activeTab,
        hideNoSupplyPrice,
        hideNoStock,
        showOnlyBondedStock,
        advancedFilters,
        // results 는 의도적으로 저장 안 함
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [
    searchQuery,
    p.activeTab,
    hideNoSupplyPrice,
    hideNoStock,
    showOnlyBondedStock,
    advancedFilters,
  ]);

  const handleSearch = useCallback(async () => {
    const hasFilters = Object.values(advancedFilters).some((f) => (f as any).enabled);
    if (!searchQuery.trim() && !hasFilters) {
      setError("검색어 또는 필터 조건을 설정해주세요.");
      return;
    }
    setIsSearching(true);
    setError("");
    setHasSearched(true);
    try {
      let endpoint: string;
      if (hasFilters) {
        const params = new URLSearchParams();
        params.set("tab", p.activeTab);
        if (searchQuery.trim()) params.set("q", searchQuery);
        const f = advancedFilters;
        const appendRange = (
          prefix: string,
          r: { enabled: boolean; min: string; max: string },
        ) => {
          if (!r.enabled) return;
          if (r.min !== "") params.set(`${prefix}Min`, r.min);
          if (r.max !== "") params.set(`${prefix}Max`, r.max);
        };
        appendRange("stock", f.stock);
        appendRange("sales30", f.sales30);
        appendRange("sales90", f.sales90);
        appendRange("vintage", f.vintage);
        appendRange("supplyPrice", f.supplyPrice);
        appendRange("retailPrice", f.retailPrice);
        appendRange("minPrice", f.minPrice);
        if (f.country.enabled && f.country.value) params.set("country", f.country.value);
        endpoint = `/api/inventory/filter?${params.toString()}`;
      } else {
        endpoint =
          p.activeTab === "CDV"
            ? `/api/inventory/search?q=${encodeURIComponent(searchQuery)}`
            : `/api/inventory/dl/search?q=${encodeURIComponent(searchQuery)}`;
      }
      const response = await fetch(endpoint);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "검색 중 오류가 발생했습니다.");
      }
      const items: InventoryItem[] = data.results || [];

      // CDV 탭에서는 재고가 없는 미착품(수입 일정에만 있는 품목)도 병합
      if (p.activeTab === "CDV") {
        const existingCodes = new Set(items.map((i) => i.item_no));
        const q = searchQuery.toLowerCase();
        for (const [code, schedules] of Object.entries(p.importScheduleMap)) {
          if (existingCodes.has(code)) continue;
          const s = schedules[0];
          const matchCode = code.toLowerCase().includes(q);
          const matchBrand = s.brand_code.toLowerCase() === q;
          const matchName =
            q.length >= 3 &&
            (s.item_name_kr.toLowerCase().includes(q) ||
              s.item_name_en.toLowerCase().includes(q));
          if (matchCode || matchBrand || matchName) {
            items.push({
              item_no: code,
              item_name: s.item_name_kr || s.item_name_en,
              brand: s.brand_code,
              vintage: s.vintage,
              supply_price: 0,
              discount_price: 0,
              wholesale_price: 0,
              retail_price: 0,
              min_price: 0,
              available_stock: 0,
              incoming_stock: 0,
              sales_30days: 0,
              total_stock: 0,
              alcohol_content: "",
              country: "",
              _isImportOnly: true,
            } as InventoryItem & { _isImportOnly?: boolean });
          }
        }
      }

      setResults(items);
      // CDV: 검색 결과를 사전 로드된 인덱스(tastingNoteSet)에 대조해 마킹.
      // 기존 N+1 fetch 제거 — 50~200건 검색마다 동일 수의 네트워크 요청 발생하던 문제.
      if (p.activeTab === "CDV" && p.tastingNoteSet.size > 0) {
        for (const item of items) {
          if (p.tastingNoteSet.has(item.item_no)) p.onCheckTastingNote(item.item_no);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "검색 중 오류가 발생했습니다.");
      setResults([]);
    } finally {
      setIsSearching(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, advancedFilters, p.activeTab, p.importScheduleMap]);

  // 인덱스(tastingNoteSet)가 검색보다 늦게 로드되는 레이스 방지:
  // 세트나 결과가 바뀌면 현재 결과를 재대조해 테이스팅노트 초록 표시를 항상 채운다.
  useEffect(() => {
    if (p.activeTab !== "CDV" || p.tastingNoteSet.size === 0 || results.length === 0) return;
    for (const item of results) {
      if (p.tastingNoteSet.has(item.item_no)) p.onCheckTastingNote(item.item_no);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.tastingNoteSet, results, p.activeTab]);

  /** 탭 전환 시 초기화 (search query/results/hasSearched) */
  const resetForTabSwitch = useCallback(() => {
    setResults([]);
    setHasSearched(false);
    setSearchQuery("");
  }, []);

  /** 클라이언트 필터 적용된 결과 */
  const filteredResults = applyClientFilters({
    results,
    activeTab: p.activeTab,
    hideNoSupplyPrice,
    hideNoStock,
    showOnlyBondedStock,
    advancedFilters,
    importScheduleMap: p.importScheduleMap,
  });

  const activeFilterCount = Object.values(advancedFilters).filter(
    (f) => (f as any).enabled,
  ).length;

  return {
    searchQuery,
    setSearchQuery,
    results,
    setResults,
    filteredResults,
    isSearching,
    hasSearched,
    error,
    hideNoSupplyPrice,
    setHideNoSupplyPrice,
    hideNoStock,
    setHideNoStock,
    showOnlyBondedStock,
    setShowOnlyBondedStock,
    advancedFilters,
    setAdvancedFilters,
    activeFilterCount,
    handleSearch,
    resetForTabSwitch,
  };
}

