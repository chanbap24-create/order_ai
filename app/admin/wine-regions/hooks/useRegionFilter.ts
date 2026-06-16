'use client';

import { useMemo, useState } from 'react';
import type { RegionTree, WineRegion } from '../types';

// 광역(super) 묶음 — major_region(district) → super_region(광역). 여러 district 를 거느린 광역만 등록.
// 미등록 major(알자스·샴페인·이탈리아·미국 등)는 광역=자기자신 → 트리에서 평면 표시(collapse).
const SUPER_REGION_KO: Record<string, string> = {
  '메독 Médoc': '보르도 Bordeaux', '그라브 Graves': '보르도 Bordeaux',
  '우안 Right Bank': '보르도 Bordeaux', '소테른 Sauternes': '보르도 Bordeaux', '기타 보르도': '보르도 Bordeaux',
  '샤블리 Chablis': '부르고뉴 Bourgogne', '코트 드 뉘 Côte de Nuits': '부르고뉴 Bourgogne',
  '코트 드 본 Côte de Beaune': '부르고뉴 Bourgogne', '코트 샬로네즈 Côte Chalonnaise': '부르고뉴 Bourgogne',
  '마코네 Mâconnais': '부르고뉴 Bourgogne', '광역 Régionale': '부르고뉴 Bourgogne',
  '북부 론 Northern Rhône': '론 Rhône', '남부 론 Southern Rhône': '론 Rhône',
  '상부 루아르 Upper Loire': '루아르 Loire', '투렌 Touraine': '루아르 Loire',
  '앙주소뮈르 Anjou-Saumur': '루아르 Loire', '낭트 Nantais': '루아르 Loire',
  '랑그독 Languedoc': '랑그독·루시용 Languedoc-Roussillon', '루시용 Roussillon': '랑그독·루시용 Languedoc-Roussillon',
};
const superOf = (major: string) => SUPER_REGION_KO[major] || major;

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
      const sup = superOf(major);
      const sub = r.sub_region || '(직접)';
      if (!countryMap.has(country)) countryMap.set(country, new Map());
      const superMap = countryMap.get(country)!;
      if (!superMap.has(sup)) superMap.set(sup, new Map());
      const majorMap = superMap.get(sup)!;
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
    tree.forEach((superMap, country) => {
      keys.add(country);
      superMap.forEach((majorMap, sup) => {
        const superKey = `${country}>${sup}`;
        keys.add(superKey);
        majorMap.forEach((subMap, major) => {
          const majorKey = `${superKey}>${major}`;
          keys.add(majorKey);
          subMap.forEach((_, sub) => keys.add(`${majorKey}>${sub}`));
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
