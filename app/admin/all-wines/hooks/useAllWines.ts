'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CountryOption, WineRowExt } from '../types';

export function useAllWines() {
  const [wines, setWines] = useState<WineRowExt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [country, setCountry] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [hideZero, setHideZero] = useState(true);
  // 가격대(공급가)별 최소 가용재고 — 해당 가격대에서 이 수량 미만이면 숨김(0=무필터). 기본값 적용.
  const [minStock, setMinStock] = useState({ u20k: 120, u50k: 60, u100k: 24, u200k: 12, over: 1 });
  const [savingPref, setSavingPref] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 계정(어드민)에 저장된 필터 설정 로드 — 있으면 기본값 대신 사용
  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/wines/filter-pref')
      .then(r => r.json())
      .then(j => { if (!cancelled && j.minStock) setMinStock(j.minStock); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // 현재 필터 설정을 계정에 저장
  const saveMinStock = async () => {
    setSavingPref(true);
    try {
      await fetch('/api/admin/wines/filter-pref', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minStock }),
      });
    } catch { /* ignore */ } finally { setSavingPref(false); }
  };

  // search 300ms debounce — 타이핑마다 API 호출 방지
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search]);

  const fetchWines = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', '50');
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (country) params.set('country', country);
    if (statusFilter) params.set('statusFilter', statusFilter);
    if (sortBy) { params.set('sortBy', sortBy); params.set('sortDir', sortDir); }
    if (hideZero) params.set('hideZero', '1');
    if (minStock.u20k || minStock.u50k || minStock.u100k || minStock.u200k || minStock.over) {
      params.set('minStock', JSON.stringify(minStock));
    }
    try {
      const res = await fetch(`/api/admin/wines/all?${params}`);
      const data = await res.json();
      if (data.success) {
        setWines(data.data);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        if (data.countries) setCountries(data.countries);
      }
    } catch (e) {
      console.error('[AllWinesTab] fetch error:', e);
    }
    setLoading(false);
  }, [debouncedSearch, country, statusFilter, page, sortBy, sortDir, hideZero, minStock]);

  useEffect(() => { fetchWines(); }, [fetchWines]);

  useEffect(() => { setPage(1); }, [debouncedSearch, country, statusFilter, hideZero, minStock]);

  const handleSort = (col: string) => {
    if (sortBy === col) {
      if (sortDir === 'asc') setSortDir('desc');
      else { setSortBy(''); setSortDir('asc'); }
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
    setPage(1);
  };

  const sortArrow = (col: string) => {
    if (sortBy !== col) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  };

  return {
    wines, setWines, loading, total, totalPages, page, setPage,
    search, setSearch, country, setCountry, statusFilter, setStatusFilter,
    countries, sortBy, sortDir, hideZero, setHideZero,
    minStock, setMinStock, saveMinStock, savingPref,
    handleSort, sortArrow, fetchWines,
  };
}
