import { useCallback, useEffect, useState } from "react";
import type { ImportScheduleItem } from "@/app/types/wine";
import type { Meeting, ViewMode } from "../types";
import { formatDate, getMonthRange, getWeekRange } from "../lib/format";
import { CACHE_TTL, getCached, setCached } from "../lib/cache";

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

  // 수입일정 (1h 캐시, 현재월+다음월)
  useEffect(() => {
    const s = new Date(weekBase.getFullYear(), weekBase.getMonth(), 1);
    const e = new Date(weekBase.getFullYear(), weekBase.getMonth() + 2, 0);
    const cacheKey = `import_schedule_${formatDate(s)}_${formatDate(e)}`;
    const cached = getCached<ImportScheduleItem[]>(cacheKey, CACHE_TTL.IMPORT_SCHEDULE);
    if (cached) setImportItems(cached);

    const fetchImport = async () => {
      try {
        const params = new URLSearchParams({
          start_date: formatDate(s),
          end_date: formatDate(e),
        });
        const res = await fetch(`/api/admin/upload-data/import-schedule?${params}`);
        const json = await res.json();
        const items: ImportScheduleItem[] = json.items || [];
        setImportItems(items);
        setCached(cacheKey, items);
      } catch {
        if (!cached) setImportItems([]);
      }
    };
    fetchImport();
  }, [weekBase]);

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
