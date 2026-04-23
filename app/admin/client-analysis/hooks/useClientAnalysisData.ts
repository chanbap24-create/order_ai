'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  AnalysisData, AnalysisType, Filters, FilterState, TrendPoint,
} from '../types';

function initialFilterState(): FilterState {
  return {
    manager: '',
    department: '',
    businessType: '',
    clientSearch: '',
    startDate: `${new Date().getFullYear()}-01-01`,
    endDate: new Date().toISOString().slice(0, 10),
  };
}

function buildParams(type: AnalysisType, f: FilterState, overrideDates?: { startDate: string; endDate: string }) {
  const params = new URLSearchParams({ type });
  if (f.manager) params.set('manager', f.manager);
  if (f.department) params.set('department', f.department);
  if (f.businessType) params.set('businessType', f.businessType);
  if (f.clientSearch) params.set('clientSearch', f.clientSearch);
  const start = overrideDates?.startDate ?? f.startDate;
  const end = overrideDates?.endDate ?? f.endDate;
  if (start) params.set('startDate', start);
  if (end) params.set('endDate', end);
  return params;
}

export function useClientAnalysisData() {
  const [type, setType] = useState<AnalysisType>('wine');
  const [filters, setFilters] = useState<Filters | null>(null);
  const [filterState, setFilterState] = useState<FilterState>(initialFilterState);
  const [data, setData] = useState<AnalysisData | null>(null);
  const [lastYearTrend, setLastYearTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);

  // Load filters (per type)
  useEffect(() => {
    setFilterLoading(true);
    fetch(`/api/admin/client-analysis/filters?type=${type}`)
      .then(r => r.json())
      .then(d => { if (d.success) setFilters(d); })
      .catch(() => {})
      .finally(() => setFilterLoading(false));
  }, [type]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildParams(type, filterState);
      const res = await fetch(`/api/admin/client-analysis?${params}`);
      const json = await res.json();
      if (json.success) setData(json);

      // 작년 동기간
      const lyStart = filterState.startDate.replace(/^\d{4}/, String(Number(filterState.startDate.slice(0, 4)) - 1));
      const lyEnd = filterState.endDate.replace(/^\d{4}/, String(Number(filterState.endDate.slice(0, 4)) - 1));
      const lyParams = buildParams(type, filterState, { startDate: lyStart, endDate: lyEnd });
      const lyRes = await fetch(`/api/admin/client-analysis?${lyParams}`);
      const lyJson = await lyRes.json();
      if (lyJson.success && lyJson.dailyTrend) {
        setLastYearTrend(lyJson.dailyTrend);
      } else {
        setLastYearTrend([]);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [type, filterState]);

  useEffect(() => { loadData(); }, [loadData]);

  const resetFilters = useCallback(() => {
    setFilterState(initialFilterState());
  }, []);

  const updateFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilterState(prev => ({ ...prev, [key]: value }));
  }, []);

  const changeType = useCallback((t: AnalysisType) => {
    setType(t);
    setFilterState(initialFilterState());
  }, []);

  return {
    type, changeType,
    filters, filterLoading,
    filterState, updateFilter, resetFilters,
    data, lastYearTrend, loading,
  };
}
