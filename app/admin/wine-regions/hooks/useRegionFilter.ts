'use client';

import { useMemo, useState } from 'react';
import type { RegionTree, WineRegion } from '../types';

export function useRegionFilter(regions: WineRegion[]) {
  const [search, setSearch] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    let list = regions;
    if (selectedCountry) {
      list = list.filter(r => r.country === selectedCountry);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        (r.country || '').toLowerCase().includes(q) ||
        (r.major_region || '').toLowerCase().includes(q) ||
        (r.sub_region || '').toLowerCase().includes(q) ||
        (r.appellation || '').toLowerCase().includes(q) ||
        (r.cru_vineyard || '').toLowerCase().includes(q) ||
        (r.classification || '').toLowerCase().includes(q) ||
        (r.grape_varieties || '').toLowerCase().includes(q) ||
        (r.notes || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [regions, search, selectedCountry]);

  const countryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    regions.forEach(r => {
      map[r.country] = (map[r.country] || 0) + 1;
    });
    return map;
  }, [regions]);

  const tree: RegionTree = useMemo(() => {
    const countryMap: RegionTree = new Map();
    for (const r of filtered) {
      const country = r.country || '(미지정)';
      const major = r.major_region || '(미지정)';
      const sub = r.sub_region || '(직접)';
      if (!countryMap.has(country)) countryMap.set(country, new Map());
      const majorMap = countryMap.get(country)!;
      if (!majorMap.has(major)) majorMap.set(major, new Map());
      const subMap = majorMap.get(major)!;
      if (!subMap.has(sub)) subMap.set(sub, []);
      subMap.get(sub)!.push(r);
    }
    return countryMap;
  }, [filtered]);

  const toggleExpand = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const expandAll = () => {
    const keys = new Set<string>();
    tree.forEach((majorMap, country) => {
      keys.add(country);
      majorMap.forEach((subMap, major) => {
        const majorKey = `${country}>${major}`;
        keys.add(majorKey);
        subMap.forEach((_, sub) => {
          keys.add(`${majorKey}>${sub}`);
        });
      });
    });
    setExpanded(keys);
  };

  const collapseAll = () => setExpanded(new Set());

  const selectCountry = (v: string) => {
    setSelectedCountry(v);
    setExpanded(new Set());
  };

  return {
    search, setSearch,
    selectedCountry, selectCountry,
    expanded, toggleExpand, expandAll, collapseAll,
    filtered, countryCounts, tree,
  };
}
