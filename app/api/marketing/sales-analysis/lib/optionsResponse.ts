import { NextResponse } from 'next/server';
import { ITEM_CATEGORY_MAP } from './constants';
import { REGION_GROUPS, SUB_REGION_GROUPS } from './regionGroups';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WineRow = any;

/**
 * mode=options 응답: 선택 가능한 필터 값 목록 (지역 그룹 기반).
 */
export function buildOptionsResponse(wines: WineRow[], brandNameMap: Map<string, string>) {
  const countries = new Set<string>();
  for (const w of wines) {
    if (w.country) countries.add(w.country);
  }

  const types = new Set(Object.values(ITEM_CATEGORY_MAP));

  const regionsObj: Record<string, string[]> = {};
  for (const [c, groups] of Object.entries(REGION_GROUPS)) {
    regionsObj[c] = groups.map((g) => g.label);
  }

  const subRegionsObj: Record<string, Record<string, string[]>> = {};
  for (const [c, regionMap] of Object.entries(SUB_REGION_GROUPS)) {
    subRegionsObj[c] = {};
    for (const [rg, subs] of Object.entries(regionMap)) {
      subRegionsObj[c][rg] = subs.map((s) => s.label);
    }
  }

  const brands = [...brandNameMap.entries()]
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({
    countries: [...countries].sort(),
    regions: regionsObj,
    sub_regions: subRegionsObj,
    types: [...types].sort(),
    brands,
    volumes: ['750ml', '375ml', '500ml', '1.5L', '3L', '187ml'],
  });
}
