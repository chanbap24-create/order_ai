import { getItemCategory, extractBrandCode, normalizeCountry } from './constants';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WineRow = any;

// 빈티지 매칭용 사전 계산 캐시
export function buildVintageMap(wineMap: Map<string, WineRow>): Map<string, { abbr: string; data: WineRow }[]> {
  const vintageMap = new Map<string, { abbr: string; data: WineRow }[]>();
  for (const [k, v] of wineMap) {
    const base = k.slice(0, 2) + k.slice(4);
    const abbr = ((v.item_name_kr || '').match(/^([A-Z]{2})\s/) || [])[1] || '';
    if (!vintageMap.has(base)) vintageMap.set(base, []);
    vintageMap.get(base)!.push({ abbr, data: v });
  }
  return vintageMap;
}

export type ResolvedWine = {
  country: string | null;
  region: string | null;
  wineType: string | null;
  brandCode: string | null;
};

/**
 * 와인 정보 매칭 (캐시 기반 O(1) 빈티지 매칭).
 */
export function resolveWine(
  itemNo: string, itemName: string,
  wineMap: Map<string, WineRow>, invMap: Map<string, string>,
  brandCountry: Map<string, string>,
  vintageMap: Map<string, { abbr: string; data: WineRow }[]>,
): ResolvedWine {
  let country: string | null = null, region: string | null = null, wineType: string | null = null;

  const brandCode = extractBrandCode(itemName);

  const w = wineMap.get(itemNo);
  if (w) { country = w.country; region = w.region; wineType = w.wine_type; }
  if (!country) country = invMap.get(itemNo) || null;
  if (!country) {
    const base = itemNo.slice(0, 2) + itemNo.slice(4);
    const nameAbbr = (itemName.match(/^([A-Z]{2})\s/) || [])[1] || '';
    const candidates = vintageMap.get(base);
    if (candidates) {
      for (const c of candidates) {
        if (nameAbbr && c.abbr && nameAbbr !== c.abbr) continue;
        country = c.data.country; region = c.data.region; wineType = c.data.wine_type; break;
      }
    }
  }
  if (!country && brandCode && brandCountry.has(brandCode)) {
    country = brandCountry.get(brandCode)!;
  }

  // 품번 첫 글자 기반 분류 우선
  const codeCategory = getItemCategory(itemNo);
  if (codeCategory) wineType = codeCategory;

  return { country: normalizeCountry(country), region, wineType, brandCode };
}
