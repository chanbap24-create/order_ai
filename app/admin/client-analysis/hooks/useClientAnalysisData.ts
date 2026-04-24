'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AnalysisData, AnalysisType, Filters, FilterState, TrendPoint,
} from '../types';
import { getCached, setCached, clearCacheByPrefix, CACHE_TTL } from '@/app/lib/sessionCache';

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

const CACHE_PREFIX = 'admin_client_analysis:';
const SEARCH_DEBOUNCE_MS = 300;

type Combined = { data: AnalysisData; lastYearTrend: TrendPoint[] };

function makeCacheKey(type: AnalysisType, f: FilterState): string {
  return `${CACHE_PREFIX}${type}|${f.manager}|${f.department}|${f.businessType}|${f.clientSearch}|${f.startDate}|${f.endDate}`;
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

  const applyCombined = useCallback((c: Combined) => {
    setData(c.data);
    setLastYearTrend(c.lastYearTrend);
  }, []);

  const loadData = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!silent) setLoading(true);
    try {
      // 현재 + 작년 동기간 API 를 병렬 호출 (기존에는 순차였음)
      const params = buildParams(type, filterState);
      const lyStart = filterState.startDate.replace(/^\d{4}/, String(Number(filterState.startDate.slice(0, 4)) - 1));
      const lyEnd = filterState.endDate.replace(/^\d{4}/, String(Number(filterState.endDate.slice(0, 4)) - 1));
      const lyParams = buildParams(type, filterState, { startDate: lyStart, endDate: lyEnd });

      const [res, lyRes] = await Promise.all([
        fetch(`/api/admin/client-analysis?${params}`),
        fetch(`/api/admin/client-analysis?${lyParams}`),
      ]);
      const [json, lyJson] = await Promise.all([res.json(), lyRes.json()]);

      if (json.success) {
        const ly = (lyJson?.success && lyJson.dailyTrend) ? lyJson.dailyTrend as TrendPoint[] : [];
        const combined: Combined = { data: json as AnalysisData, lastYearTrend: ly };
        applyCombined(combined);
        setCached(makeCacheKey(type, filterState), combined);
      }
    } catch { /* ignore */ }
    if (!silent) setLoading(false);
  }, [type, filterState, applyCombined]);

  // filterState 변경 → 검색어는 debounce, 그 외 값은 즉시
  // clientSearch 만 바뀐 경우 300ms 지연; 나머지 필터 변경은 즉시
  const prevSearchRef = useRef<string>(filterState.clientSearch);
  const prevOtherKeyRef = useRef<string>('');

  useEffect(() => {
    const otherKey = `${type}|${filterState.manager}|${filterState.department}|${filterState.businessType}|${filterState.startDate}|${filterState.endDate}`;
    const otherChanged = otherKey !== prevOtherKeyRef.current;
    const searchChanged = filterState.clientSearch !== prevSearchRef.current;
    prevOtherKeyRef.current = otherKey;
    prevSearchRef.current = filterState.clientSearch;

    // 캐시 hit 시 즉시 표시 + silent refresh
    const cacheKey = makeCacheKey(type, filterState);
    const cached = getCached<Combined>(cacheKey, CACHE_TTL.ADMIN_CLIENT_ANALYSIS);
    if (cached) {
      applyCombined(cached);
      const tid = setTimeout(() => loadData({ silent: true }), otherChanged ? 0 : searchChanged ? SEARCH_DEBOUNCE_MS : 0);
      return () => clearTimeout(tid);
    }

    // 캐시 miss 시: 검색어만 바뀐 경우 debounce, 그 외 즉시
    if (!otherChanged && searchChanged) {
      const tid = setTimeout(() => loadData(), SEARCH_DEBOUNCE_MS);
      return () => clearTimeout(tid);
    }
    loadData();
  }, [type, filterState, loadData, applyCombined]);

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

  const invalidateCache = useCallback(() => {
    clearCacheByPrefix(CACHE_PREFIX);
  }, []);

  return {
    type, changeType,
    filters, filterLoading,
    filterState, updateFilter, resetFilters,
    data, lastYearTrend, loading,
    invalidateCache,
  };
}
