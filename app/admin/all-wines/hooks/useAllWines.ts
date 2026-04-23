'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CountryOption, WineRowExt } from '../types';

export function useAllWines() {
  const [wines, setWines] = useState<WineRowExt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [hideZero, setHideZero] = useState(true);

  const fetchWines = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', '50');
    if (search) params.set('search', search);
    if (country) params.set('country', country);
    if (statusFilter) params.set('statusFilter', statusFilter);
    if (sortBy) { params.set('sortBy', sortBy); params.set('sortDir', sortDir); }
    if (hideZero) params.set('hideZero', '1');
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
  }, [search, country, statusFilter, page, sortBy, sortDir, hideZero]);

  useEffect(() => { fetchWines(); }, [fetchWines]);

  useEffect(() => { setPage(1); }, [search, country, statusFilter, hideZero]);

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
    handleSort, sortArrow, fetchWines,
  };
}
