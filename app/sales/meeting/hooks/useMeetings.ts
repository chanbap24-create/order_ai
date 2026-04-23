import { useCallback, useEffect, useState } from "react";
import type { ImportScheduleItem } from "@/app/types/wine";
import type { Meeting, ViewMode } from "../types";
import { formatDate, getMonthRange, getWeekRange } from "../lib/format";

type Params = {
  isAdmin: boolean;
  currentManager: string;
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
  const [managers, setManagers] = useState<string[]>([]);
  const [holidays, setHolidays] = useState<Record<string, string>>({});
  const [importItems, setImportItems] = useState<ImportScheduleItem[]>([]);

  const { start: weekStart, end: weekEnd } =
    viewMode === "week" ? getWeekRange(weekBase) : getMonthRange(weekBase);

  // admin: 담당자 목록
  useEffect(() => {
    if (!p.isAdmin) return;
    fetch("/api/sales/clients/managers")
      .then((r) => r.json())
      .then((d) => {
        if (d.managers) setManagers(d.managers);
      })
      .catch(() => {});
  }, [p.isAdmin]);

  // 공휴일
  useEffect(() => {
    const year = weekBase.getFullYear();
    fetch(`/api/sales/holidays?year=${year}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.holidays) setHolidays((prev) => ({ ...prev, ...d.holidays }));
      })
      .catch(() => {});
  }, [weekBase]);

  // 수입일정 (현재월 ±3개월)
  useEffect(() => {
    const fetchImport = async () => {
      try {
        const s = new Date(weekBase.getFullYear(), weekBase.getMonth() - 1, 1);
        const e = new Date(weekBase.getFullYear(), weekBase.getMonth() + 4, 0);
        const params = new URLSearchParams({
          start_date: formatDate(s),
          end_date: formatDate(e),
        });
        const res = await fetch(`/api/admin/upload-data/import-schedule?${params}`);
        const json = await res.json();
        setImportItems(json.items || []);
      } catch {
        setImportItems([]);
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
