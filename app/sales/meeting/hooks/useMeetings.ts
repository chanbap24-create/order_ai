import { useCallback, useEffect, useState } from "react";
import type { ImportScheduleItem } from "@/app/types/wine";
import type { Meeting, ViewMode } from "../types";
import { formatDate, getMonthRange, getWeekRange } from "../lib/format";
import {
  CACHE_TTL, getCached, setCached,
  subscribeDataInvalidation, clearCacheByPrefix,
} from "../lib/cache";

type Params = {
  isAdmin: boolean;
  currentManager: string;
  /** 상위에서 미리 로드한 담당자 목록 (중복 fetch 방지) */
  initialManagers?: string[];
};

/**
 * 미팅 + 공휴일 + 수입일정 데이터 로드 관리.
 * viewMode(week/month) + weekBase + filterManager 기반.
 */
export function useMeetings(p: Params) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [weekBase, setWeekBase] = useState(new Date());
  const [filterManager, setFilterManager] = useState(p.isAdmin ? "" : p.currentManager);
  const [managers, setManagers] = useState<string[]>(p.initialManagers || []);
  const [holidays, setHolidays] = useState<Record<string, string>>({});
  const [importItems, setImportItems] = useState<ImportScheduleItem[]>([]);

  const { start: weekStart, end: weekEnd } =
    viewMode === "week" ? getWeekRange(weekBase) : getMonthRange(weekBase);

  // admin: 담당자 목록 (initialManagers로 hydrate된 경우 fetch 생략)
  useEffect(() => {
    if (!p.isAdmin) return;
    if (p.initialManagers && p.initialManagers.length > 0) return;
    fetch("/api/sales/clients/managers")
      .then((r) => r.json())
      .then((d) => {
        if (d.managers) setManagers(d.managers);
      })
      .catch(() => {});
  }, [p.isAdmin, p.initialManagers]);

  // 공휴일 (24h 캐시: 즉시 표시 → 백그라운드 갱신)
  useEffect(() => {
    const year = weekBase.getFullYear();
    const cacheKey = `holidays_${year}`;
    const cached = getCached<Record<string, string>>(cacheKey, CACHE_TTL.HOLIDAYS);
    if (cached) setHolidays((prev) => ({ ...prev, ...cached }));
    fetch(`/api/sales/holidays?year=${year}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.holidays) {
          setHolidays((prev) => ({ ...prev, ...d.holidays }));
          setCached(cacheKey, d.holidays);
        }
      })
      .catch(() => {});
  }, [weekBase]);

  // 수입일정: 오늘 이후 입항만 한 번에 로드 (지난 일정은 제외).
  // 사이드바(ImportSidebar)는 weekBase 와 무관하게 전체를 표시.
  // 월별 달력 뱃지는 importByDate 로 per-date 조회하므로 범위 넓어도 문제 없음.
  // 캐시 2분, admin 업로드 이벤트 수신 시 즉시 refetch.
  useEffect(() => {
    const today = formatDate(new Date());
    const cacheKey = `import_schedule_from_${today}`;
    const cached = getCached<ImportScheduleItem[]>(cacheKey, CACHE_TTL.IMPORT_SCHEDULE);
    if (cached && cached.length > 0) setImportItems(cached);

    const fetchImport = async () => {
      try {
        const params = new URLSearchParams({ start_date: today });
        const res = await fetch(`/api/admin/upload-data/import-schedule?${params}`, { cache: "no-store" });
        if (!res.ok) {
          console.warn(`[useMeetings] import-schedule fetch failed: ${res.status}`);
          if (!cached) setImportItems([]);
          return;
        }
        const json = await res.json();
        if (!json.success) {
          console.warn("[useMeetings] import-schedule response no-success:", json);
          if (!cached) setImportItems([]);
          return;
        }
        const items: ImportScheduleItem[] = json.items || [];
        setImportItems(items);
        setCached(cacheKey, items);
      } catch (e) {
        console.warn("[useMeetings] import-schedule fetch error:", e);
        if (!cached) setImportItems([]);
      }
    };
    fetchImport();

    const unsub = subscribeDataInvalidation("import_schedule", () => {
      clearCacheByPrefix("import_schedule_");
      fetchImport();
    });
    return unsub;
    // weekBase 의존성 제거 — 월 이동 시 재조회 불필요 (전체 로드 후 per-date 조회)
  }, []);

  const loadMeetings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        date_from: formatDate(weekStart),
        date_to: formatDate(weekEnd),
      });
      if (filterManager) params.set("manager", filterManager);
      const res = await fetch(`/api/sales/meetings?${params}`);
      const json = await res.json();
      setMeetings(json.meetings || []);
    } catch {
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  }, [formatDate(weekStart), formatDate(weekEnd), filterManager]);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  const prevPeriod = () => {
    const d = new Date(weekBase);
    if (viewMode === "week") d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setWeekBase(d);
  };

  const nextPeriod = () => {
    const d = new Date(weekBase);
    if (viewMode === "week") d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setWeekBase(d);
  };

  const goToday = () => setWeekBase(new Date());

  return {
    meetings,
    loading,
    viewMode,
    setViewMode,
    weekBase,
    weekStart,
    weekEnd,
    filterManager,
    setFilterManager,
    managers,
    holidays,
    importItems,
    loadMeetings,
    prevPeriod,
    nextPeriod,
    goToday,
  };
}
