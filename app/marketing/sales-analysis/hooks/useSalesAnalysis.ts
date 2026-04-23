'use client';

import { useEffect, useState } from 'react';
import type { AnalysisData, FilterOptions } from '../types';

export function useSalesAnalysis() {
  const [options, setOptions] = useState<FilterOptions | null>(null);

  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today = kstNow.toISOString().slice(0, 10);
  const twoYearsAgo = `${kstNow.getUTCFullYear() - 2}-${String(kstNow.getUTCMonth() + 1).padStart(2, '0')}-01`;

  const [startDate, setStartDate] = useState(twoYearsAgo);
  const [endDate, setEndDate] = useState(today);
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [subRegion, setSubRegion] = useState('');
  const [wineType, setWineType] = useState('');
  const [brand, setBrand] = useState('');
  const [volume, setVolume] = useState('');
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    fetch('/api/marketing/sales-analysis?mode=options').then(r => r.json()).then(setOptions).catch(() => {});
  }, []);

  useEffect(() => { setRegion(''); setSubRegion(''); }, [country]);
  useEffect(() => { setSubRegion(''); }, [region]);

  const availableRegions = country && options?.regions[country] ? options.regions[country] : [];
  const availableSubRegions = country && region && options?.sub_regions?.[country]?.[region]
    ? options.sub_regions[country][region] : [];

  const handleSearch = async () => {
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
      if (country) params.set('country', country);
      if (region) params.set('region', region);
      if (wineType) params.set('wine_type', wineType);
      if (brand) params.set('brand', brand);
      if (volume) params.set('volume', volume);
      if (subRegion) params.set('sub_region', subRegion);
      const res = await fetch(`/api/marketing/sales-analysis?${params}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const y = kstNow.getUTCFullYear();
  const quickRanges = [
    { label: '올해', start: `${y}-01-01`, end: `${y}-12-31` },
    { label: '1년', start: `${y - 1}-01-01`, end: `${y - 1}-12-31` },
    { label: '2년', start: `${y - 2}-01-01`, end: `${y - 1}-12-31` },
    { label: '3년', start: `${y - 3}-01-01`, end: `${y - 1}-12-31` },
  ];

  return {
    options, quickRanges,
    startDate, setStartDate, endDate, setEndDate,
    country, setCountry, region, setRegion, subRegion, setSubRegion,
    wineType, setWineType, brand, setBrand, volume, setVolume,
    availableRegions, availableSubRegions,
    data, loading, searched, handleSearch,
  };
}
